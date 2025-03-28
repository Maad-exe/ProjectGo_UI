import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, of, timer, from, concat } from 'rxjs';
import { environment } from '../../env/env';
import * as signalR from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { catchError, shareReplay, tap, throttleTime, map, switchMap, retry, finalize, timeout, take } from 'rxjs/operators';

export interface MessageReadStatus {
  userId: number;
  userName: string;
  readAt: string;
  
}

export interface ChatMessage {
  id: number;
  groupId: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  readBy: MessageReadStatus[];
  totalReadCount: number;
  isReadByCurrentUser: boolean;
}

export interface UserTypingInfo {
  userId: number;
  userName: string;
  groupId: number;
  timestamp: Date;
}

// Add a user interface to work with getCurrentUser
interface User {
  id: number;
  name: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${environment.apiBaseUrl}/chat`;
  private hubConnection: signalR.HubConnection | null = null;
  private connectionPromise: Promise<void> | null = null;
  private lastLoggedInUserId: number | null = null;
  private connectionAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private messageCache: Map<number, ChatMessage[]> = new Map();
  private _isConnecting: boolean = false;
  private reconnectTimeout: any = null;
  
  // Observables to subscribe to
  private messageReceivedSubject = new Subject<ChatMessage>();
  messageReceived$ = this.messageReceivedSubject.asObservable();
  
  private unreadMessagesSubject = new BehaviorSubject<number>(0);
  unreadMessages$ = this.unreadMessagesSubject.asObservable();
  
  private userTypingSubject = new Subject<UserTypingInfo>();
  userTyping$ = this.userTypingSubject.pipe(
    throttleTime(1000)
  );
  
  // Update the messageRead$ observable to include userName
  private messageReadSubject = new Subject<{userId: number, userName?: string, groupId: number}>();
  messageRead$ = this.messageReadSubject.asObservable();
  
  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();
  
  private _activeGroups: number[] = [];
  
  // Add a local cache for unread counts
  private lastKnownUnreadCount: number = 0;
  private unreadCountsByGroup: { [groupId: string]: number } = {};

  // Update the constructor to trigger unread count immediately
  // Update constructor with immediate updates
  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Immediately check for unread messages
    this.updateUnreadCountImmediate();
    
    // Set up visibility change listener for page reloads/tab focus
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.updateUnreadCountImmediate();
        }
      });

      // Add window load event listener
      window.addEventListener('load', () => {
        this.updateUnreadCountImmediate();
      });
    }
    
    // Set up auth listener and periodic checks
    this.setupAuthListener();
    this.setupAggressivePeriodicChecks();
  }
  
  // Add a getCurrentUser method to replace AuthService.getCurrentUser
  private getCurrentUser(): User | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
      const decodedToken = this.authService.decodeToken(token);
      if (!decodedToken) return null;
      
      return {
        id: Number(decodedToken.UserId),
        name: decodedToken.name || 'Unknown',
        role: decodedToken.role || 'User'
      };
    } catch (err) {
      console.error('Error decoding token:', err);
      return null;
    }
  }
  
  private getCurrentUserId(): number | null {
    const user = this.getCurrentUser();
    return user ? user.id : null;
  }
  
  // Update setupAuthListener to include immediate count update
  private setupAuthListener(): void {
    this.authService.authStatusChange.subscribe(isLoggedIn => {
      console.log('Auth status changed, isLoggedIn:', isLoggedIn);
      if (isLoggedIn) {
        // Update count before connection
        this.updateUnreadCount();
        this.initConnection(true);
      } else {
        this.closeConnection();
        this.clearCache();
      }
    });
    
    // Initial connection and count if already logged in
    if (this.authService.isLoggedIn()) {
      this.updateUnreadCount();
      this.initConnection(true);
    }
  }
  
  private setupPeriodicChecks(): void {
    // Check connection health every 60 seconds
    timer(10000, 60000).subscribe(() => {
      if (this.authService.isLoggedIn()) {
        // Check connection health
        if (this.hubConnection?.state !== signalR.HubConnectionState.Connected) {
          console.log('Connection check failed, reconnecting...');
          this.reconnect(true);
        } else {
          // Ping the server to keep the connection alive
          this.pingConnection();
        }
        
        // Only update from server if connection was lost
        if (!this.connectedSubject.value) {
          this.updateUnreadCount();
        }
      }
    });
  }
  
  private pingConnection(): void {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('Ping').catch(err => {
        console.log('Ping failed, reconnecting:', err);
        this.reconnect(true);
        
      });
    }
  }
  
  private clearCache(): void {
    console.log('Clearing message cache');
    this.messageCache.clear();
  }
  
  private closeConnection(): void {
    if (this.hubConnection) {
      console.log('Closing SignalR connection');
      this.hubConnection.stop().catch(err => console.error('Error stopping connection:', err));
      this.hubConnection = null;
      this.connectionPromise = null;
      this.connectedSubject.next(false);
      this.connectionAttempts = 0;
      this._isConnecting = false;
      
      // Clear any pending reconnect timeouts
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    }
  }
  
  // Fix for chat.service.ts - initConnection method
// Fix for chat.service.ts - initConnection method
private initConnection(forceReinit: boolean = false): void {
  console.log('Initializing chat connection, forceReinit:', forceReinit);
  
  // Prevent multiple simultaneous connection attempts
  if (this._isConnecting) {
    console.log('Connection attempt already in progress, skipping');
    return;
  }

  const currentUserId = this.getCurrentUserId();
  const token = localStorage.getItem('token');
  
  // Exit early if no auth info
  if (!token || !currentUserId) {
    console.warn('Missing authentication data, skipping connection');
    return;
  }

  // Check if user changed or force reinit
  const needsNewConnection = forceReinit || 
                           currentUserId !== this.lastLoggedInUserId || 
                           !this.hubConnection;

  if (needsNewConnection) {
    console.log(`User changed or force reinit: ${this.lastLoggedInUserId} -> ${currentUserId}`);
    
    // Close existing connection if any
    if (this.hubConnection) {
      this.closeConnection();
    }
    
    // Update stored user ID
    this.lastLoggedInUserId = currentUserId;
    
    // Mark that we're connecting
    this._isConnecting = true;
    
    // Create a new connection
    console.log('Creating new SignalR connection for user:', currentUserId);
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/chatHub`, {
        accessTokenFactory: () => localStorage.getItem('token') || '',
        transport: signalR.HttpTransportType.WebSockets | 
                  signalR.HttpTransportType.ServerSentEvents | 
                  signalR.HttpTransportType.LongPolling,
        skipNegotiation: false
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();
        
    // Set up event handlers
    this.setupSignalRCallbacks();
    
    // Start the connection
    this.connectionPromise = this.startConnection();
    return;
  }
  
  // If we already have a connection but it's disconnected, try to start it
  if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Disconnected) {
    console.log('Connection exists but disconnected, restarting');
    this._isConnecting = true;
    this.connectionPromise = this.startConnection();
  }
}
  
private async startConnection(): Promise<void> {
  if (!this.hubConnection) {
    this._isConnecting = false;
    return Promise.reject("No hub connection");
  }
  
  try {
    console.log('Starting hub connection...');
    await this.hubConnection.start();
    console.log('Chat connection established for user:', this.getCurrentUserId());
    
    // Access transport info safely without using private properties
    let transportName = 'unknown';
    try {
      // Use reflection or any public methods to get transport info if needed
      if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
        transportName = 'connected';  // We don't have direct access to transport name
      }
    } catch (e) {
      // Ignore errors in transport detection
    }
    
    console.log('Chat connection established using transport:', transportName);
    this.connectedSubject.next(true);
    this.connectionAttempts = 0;
    this._isConnecting = false;
    
    // Re-join active groups after successful connection
    await this.rejoinActiveGroups();
    return Promise.resolve();
  } catch (err) {
    console.error('Error establishing connection:', err);
    this.connectedSubject.next(false);
    
    // Implement exponential backoff
    this.connectionAttempts++;
    if (this.connectionAttempts <= this.MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * (Math.pow(2, this.connectionAttempts)), 30000);
      console.log(`Retrying connection in ${delay}ms (attempt ${this.connectionAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
      
      // Clear any existing timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      return new Promise<void>((resolve, reject) => {
        this.reconnectTimeout = setTimeout(() => {
          this._isConnecting = false;
          this.startConnection()
            .then(resolve)
            .catch(reject);
        }, delay);
      });
    } else {
      this._isConnecting = false;
      // Final attempt: try to create a new connection
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          this.initConnection(true);
          resolve(); // Resolve anyway to prevent hanging promises
        }, 60000);
      });
    }
  }
}
  
  private async rejoinActiveGroups(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected || this._activeGroups.length === 0) return;
    
    console.log(`Rejoining ${this._activeGroups.length} active groups:`, this._activeGroups);
    
    try {
      for (const groupId of this._activeGroups) {
        try {
          await this.hubConnection.invoke('JoinGroup', groupId);
          console.log(`Rejoined group ${groupId}`);
          
          // Refresh messages for this group without blocking
          this.refreshGroupMessages(groupId).subscribe(
            messages => console.log(`Refreshed ${messages.length} messages for group ${groupId}`),
            error => console.error(`Error refreshing messages for group ${groupId}:`, error)
          );
        } catch (error) {
          console.error(`Error rejoining group ${groupId}:`, error);
          // Continue with other groups even if one fails
        }
      }
    } catch (err) {
      console.error('Error in rejoinActiveGroups:', err);
    }
  }
  
  // Update the SignalR callback to properly handle user names
  private setupSignalRCallbacks(): void {
    if (!this.hubConnection) return;
    
    // Remove all existing handlers to prevent duplicates
    this.hubConnection.off('ReceiveMessage');
    this.hubConnection.off('UserTyping');
    this.hubConnection.off('MessagesRead');
    this.hubConnection.off('JoinedGroup');
    
    // Handle incoming messages with improved unread count handling
    this.hubConnection.on('ReceiveMessage', (message: ChatMessage) => {
      console.log('Message received via SignalR:', message);
      
      // Update cache
      this.updateMessageCache(message);
      
      // Emit message for subscribers
      this.messageReceivedSubject.next(message);
      
      // Immediately update unread counts when receiving new messages
      if (message.senderId !== this.getCurrentUserId()) {
        // Increment local count
        this.lastKnownUnreadCount++;
        this.unreadMessagesSubject.next(this.lastKnownUnreadCount);
        
        // Update group-specific count
        const groupId = message.groupId.toString();
        this.unreadCountsByGroup[groupId] = (this.unreadCountsByGroup[groupId] || 0) + 1;

        // Force update from server to ensure consistency
        this.updateUnreadCount();
      }
    });
    
    // Handle typing notifications
    this.hubConnection.on('UserTyping', (userId: number, userName: string, groupId: number) => {
      if (userId !== this.getCurrentUserId()) {
        this.userTypingSubject.next({
          userId, userName, groupId, timestamp: new Date()
          
        });
      }
    });
    
    // Handle messages read notifications
    this.hubConnection.on('MessagesRead', (userId: number, userName: string, groupId: number) => {
      console.log(`MessagesRead event: User ${userId} (${userName || 'unknown'}) read messages in group ${groupId}`);
      
      // Make sure we have a valid userName
      let resolvedUserName = userName;
      if (!resolvedUserName) {
        // Try to find user's name from message cache
        const messages = this.messageCache.get(groupId) || [];
        const userMessage = messages.find(m => m.senderId === userId);
        if (userMessage && userMessage.senderName) {
          resolvedUserName = userMessage.senderName;
        } else {
          resolvedUserName = `User ${userId}`;
        }
      }
      
      this.messageReadSubject.next({ 
        userId, 
        userName: resolvedUserName, 
        groupId 
      });
      
      // Update local cache to mark messages as read
      const messages = this.messageCache.get(groupId);
      if (messages) {
        let updated = false;
        messages.forEach(msg => {
          if (msg.senderId === this.getCurrentUserId() && !msg.isRead) {
            msg.isRead = true;
            
            // Add this user to readBy array if they're not already there
            if (!msg.readBy) msg.readBy = [];
            if (!msg.readBy.some(r => r.userId === userId)) {
              msg.readBy.push({
                userId: userId,
                userName: resolvedUserName,
                readAt: new Date().toISOString()
              });
            }
            updated = true;
          }
        });
        
        if (updated) {
          this.messageCache.set(groupId, [...messages]);
        }
      }
    });
    
    // Handle successful group join
    this.hubConnection.on('JoinedGroup', (groupId: number) => {
      console.log(`Successfully joined group ${groupId}`);
      if (!this._activeGroups.includes(groupId)) {
        this._activeGroups.push(groupId);
      }
    });
    
    // Handle connection state changes
    this.hubConnection.onreconnecting(error => {
      console.log('SignalR connection reconnecting...', error);
      this.connectedSubject.next(false);
    });
    
    this.hubConnection.onreconnected(connectionId => {
      console.log('Reconnected to chat hub with ID:', connectionId);
      
      // Verify the user is still the same
      const currentUserId = this.getCurrentUserId();
      if (currentUserId !== this.lastLoggedInUserId) {
        console.warn('User changed during reconnection, reinitializing connection');
        this.initConnection(true);
      } else {
        this.connectedSubject.next(true);
        this.rejoinActiveGroups();
      }
    });
    
    this.hubConnection.onclose(error => {
      console.log('Connection to chat hub closed', error);
      this.connectedSubject.next(false);
      
      // Try to reconnect after a delay if still logged in
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        if (this.authService.isLoggedIn()) {
          console.log('Attempting to reconnect after connection closure');
          this.reconnect(true);
        }
      }, 5000);
    });
  }
  
  private updateMessageCache(message: ChatMessage): void {
    const cachedMessages = this.messageCache.get(message.groupId) || [];
    
    // Check if this is a replacement for an optimistic message
    const optimisticIndex = cachedMessages.findIndex(m => 
      m.id < 0 && 
      m.senderId === message.senderId && 
      m.content === message.content &&
      Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 30000
    );
    
    if (optimisticIndex >= 0) {
      // Replace the optimistic message
      cachedMessages[optimisticIndex] = message;
      this.messageCache.set(message.groupId, [...cachedMessages]);
    } else {
      // Check if the message already exists
      const messageExists = cachedMessages.some(m => m.id === message.id && m.id > 0);
      if (!messageExists) {
        // Add the new message to the cache
        cachedMessages.push(message);
        
        // Sort messages by timestamp to maintain order
        cachedMessages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        this.messageCache.set(message.groupId, cachedMessages);
      }
    }
  }
  
  // Get messages with improved caching
  getGroupMessages(groupId: number, limit?: number, before?: Date): Observable<ChatMessage[]> {
    const cachedMessages = this.messageCache.get(groupId) || [];
    
    // If we have cached messages and no specific pagination request
    if (cachedMessages.length > 0 && !before) {
      console.log(`Using cached messages for group ${groupId}`);
      return of(cachedMessages);
    }
    
    // Construct query parameters
    let params: any = {};
    if (limit) params.limit = limit.toString();
    if (before) params.before = before.toISOString();
    
    return this.ensureConnection().pipe(
      switchMap(connected => {
        // Even if not connected, try to fetch messages from API
        return this.http.get<ChatMessage[]>(`${this.apiUrl}/group/${groupId}`, { params }).pipe(
          retry(2),
          tap(messages => {
            console.log(`Received ${messages.length} messages for group ${groupId}`);
            // Only replace cache if this is the initial load (no pagination)
            if (!before) {
              this.messageCache.set(groupId, messages);
              
              // Join the SignalR group for this chat if connected
              if (connected) {
                this.joinGroup(groupId).subscribe();
              }
            }
          }),
          catchError(error => {
            console.error(`Error fetching messages for group ${groupId}:`, error);
            // Return cached messages if available, otherwise empty array
            return of(cachedMessages.length > 0 ? cachedMessages : []);
          })
        );
      })
    );
  }
  
  // Improved refresh mechanism
  refreshGroupMessages(groupId: number): Observable<ChatMessage[]> {
    let params: any = { limit: '50' }; // Get most recent messages
    
    return this.ensureConnection().pipe(
      switchMap(() => {
        return this.http.get<ChatMessage[]>(`${this.apiUrl}/group/${groupId}`, { params }).pipe(
          tap(messages => {
            if (messages.length > 0) {
              this.messageCache.set(groupId, messages);
            }
          }),
          catchError(error => {
            console.error(`Error refreshing messages for group ${groupId}:`, error);
            return of(this.messageCache.get(groupId) || []);
          })
        );
      })
    );
  }
  
  // Send message with optimistic updates
  sendMessage(groupId: number, content: string): Observable<ChatMessage> {
    if (!content.trim()) {
      return of(null as unknown as ChatMessage);
    }
    
    // Create an optimistic message
    const currentUser = this.getCurrentUser();
    const timestamp = new Date().toISOString();
    const tempId = -Math.floor(Math.random() * 1000000); // Temporary negative ID
    
    const optimisticMessage: ChatMessage = {
      id: tempId,
      groupId: groupId,
      senderId: currentUser?.id || -1,
      senderName: currentUser?.name || 'You',
      senderRole: currentUser?.role || 'User',
      content: content,
      timestamp: timestamp,
      isRead: false,
      readBy: [],
      totalReadCount: 0,
      isReadByCurrentUser: false
    };
    
    // Add to cache immediately for responsive UI
    this.updateMessageCache(optimisticMessage);
    // Notify subscribers about the new message
    this.messageReceivedSubject.next(optimisticMessage);
    
    // Try to send via SignalR if connected, fall back to API
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        this.hubConnection.invoke('SendMessageToGroup', groupId, content);
        return of(optimisticMessage);
      } catch (err) {
        console.error('Error sending via SignalR, falling back to API', err);
        // Continue with API approach below
      }
    }
    
    // Ensure we're connected before sending or use API as fallback
    return this.http.post<ChatMessage>(`${this.apiUrl}/send`, { 
      content: content,
      groupId: groupId 
    }).pipe(
      tap(message => {
        console.log('Message sent successfully:', message);
        // Update cache with the actual server response
        this.updateMessageCache(message);
        // Re-emit with the server message
        this.messageReceivedSubject.next(message);
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        // Mark optimistic message as failed
        const cachedMessages = this.messageCache.get(groupId) || [];
        const failedMessageIndex = cachedMessages.findIndex(m => m.id === tempId);
        
        if (failedMessageIndex >= 0) {
          cachedMessages[failedMessageIndex] = {
            ...cachedMessages[failedMessageIndex],
            content: `${content} (Failed to send)`,
            id: tempId
          };
          this.messageCache.set(groupId, [...cachedMessages]);
          this.messageReceivedSubject.next(cachedMessages[failedMessageIndex]);
        }
        
        // Return original optimistic message to maintain flow
        return of(optimisticMessage);
      }),
      finalize(() => {
        // Stop indicating typing when message is sent
        this.stopTypingNotification(groupId);
      })
    );
  }
  
  // Mark messages as read
  markMessagesAsRead(groupId: number): Observable<boolean> {
    // Skip if no unread messages
    const messages = this.messageCache.get(groupId) || [];
    const hasUnreadMessages = messages.some(m => 
      m.senderId !== this.getCurrentUserId() && !m.isRead
    );
    
    if (!hasUnreadMessages) {
      return of(true);
    }
    
    // Local update first for responsive UI - only mark messages as read for current user
    messages.forEach(msg => {
      if (msg.senderId !== this.getCurrentUserId()) {
        msg.isRead = true;
      }
    });
    this.messageCache.set(groupId, [...messages]);

    const unreadCount = messages.filter(m => 
      m.senderId !== this.getCurrentUserId() && !m.isRead
    ).length;
    
    if (unreadCount > 0) {
      // Update local counts immediately
      this.lastKnownUnreadCount = Math.max(0, this.lastKnownUnreadCount - unreadCount);
      this.unreadMessagesSubject.next(this.lastKnownUnreadCount);
      this.unreadCountsByGroup[groupId.toString()] = 0;
    }
    
    // Update server
    return this.http.post<any>(`${this.apiUrl}/mark-read/${groupId}`, {}).pipe(
      tap(() => {
        console.log(`Marked messages as read in group ${groupId}`);
        // Update unread count after marking as read
        
        this.updateUnreadCount();
        
        // Notify via SignalR if connected
        if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
          this.hubConnection.invoke('MarkMessagesAsRead', groupId)
            .catch(err => console.error('Error notifying read status:', err));
        }
      }),
      map(() => true),
      catchError(error => {
        console.error(`Error marking messages as read in group ${groupId}:`, error);
        return of(false);
      })
    );
  }
  
  // Get unread messages count
  // Update updateUnreadCount to be more responsive
  updateUnreadCount(): void {
    if (!this.authService.isLoggedIn()) return;
    
    // First emit cached count for immediate feedback
    if (this.lastKnownUnreadCount > 0) {
      this.unreadMessagesSubject.next(this.lastKnownUnreadCount);
    }
    
    // Then fetch fresh count from server
    this.http.get<{count: number}>(`${this.apiUrl}/unread-count`).pipe(
      retry(1),    // Reduced retries for faster response
      timeout(3000), // Reduced timeout
      catchError(error => {
        console.error('Error fetching unread count:', error);
        return of({ count: this.calculateCachedUnreadCount() });
      })
    ).subscribe(result => {
      // Only update if count has changed
      if (this.lastKnownUnreadCount !== result.count) {
        this.lastKnownUnreadCount = result.count;
        this.unreadMessagesSubject.next(this.lastKnownUnreadCount);
      }
    });
    
    // Also update unread counts by group - handle errors gracefully
    this.getUnreadMessagesByGroup().subscribe({
      next: groupCounts => {
        console.log('Unread messages by group:', groupCounts);
        // You can store this information for use when displaying group-specific counts
      },
      error: err => {
        console.error('Error getting unread messages by group:', err);
        // Don't cause UI issues if this fails
      }
    });
  }
  
  // Add helper method to calculate cached counts
  private calculateCachedUnreadCount(): number {
    let count = 0;
    const currentUserId = this.getCurrentUserId();
    
    this.messageCache.forEach(messages => {
      count += messages.filter(m => 
        m.senderId !== currentUserId && !m.isRead
      ).length;
    });
    
    return count;
  }
  
  // Typing notifications
  notifyTyping(groupId: number): void {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) return;
    
    this.hubConnection.invoke('NotifyTyping', groupId)
      .catch(err => console.error('Error sending typing notification:', err));
  }
  
  stopTypingNotification(groupId: number): void {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) return;
  
    // Call the SignalR hub method to stop typing notification
    this.hubConnection.invoke('StopTyping', groupId)
      .catch(err => console.error('Error stopping typing notification:', err));
  }
  
  // Group management
  joinGroup(groupId: number): Observable<boolean> {
    if (!this._activeGroups.includes(groupId)) {
      this._activeGroups.push(groupId);
    }
    
    return this.ensureConnection().pipe(
      switchMap(connected => {
        if (connected && this.hubConnection?.state === signalR.HubConnectionState.Connected) {
          return from(Promise.resolve().then(() => {
            return this.hubConnection!.invoke('JoinGroup', groupId)
              .then(() => {
                console.log(`Joined group ${groupId}`);
                return true;
              })
              .catch(err => {
                console.error(`Error joining group ${groupId}:`, err);
                return false;
              });
          }));
        }
        return of(false);
      })
    );
  }
  
  leaveGroup(groupId: number): Observable<boolean> {
    // Remove from active groups
    this._activeGroups = this._activeGroups.filter(id => id !== groupId);
    
    // Remove from cache
    this.messageCache.delete(groupId);
    
    // Leave SignalR group if connected
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return from(Promise.resolve().then(() => {
        return this.hubConnection!.invoke('LeaveGroup', groupId)
          .then(() => {
            console.log(`Left group ${groupId}`);
            return true;
          })
          .catch(err => {
            console.error(`Error leaving group ${groupId}:`, err);
            return false;
          });
      }));
    }
    
    return of(true);
  }
  
  // Ensure connection is established before operations
  private ensureConnection(): Observable<boolean> {
    if (!this.authService.isLoggedIn()) {
      return of(false);
    }
    
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return of(true);
    }
    
    if (this.connectionPromise && !this._isConnecting) {
      // Wait for existing connection attempt
      return from(Promise.resolve().then(() => {
        return this.connectionPromise!.then(() => true).catch(() => false);
      }));
    }
    
    // Not connected, not connecting, need to initialize
    if (!this._isConnecting) {
      this.initConnection();
      if (this.connectionPromise) {
        return from(Promise.resolve().then(() => {
          return this.connectionPromise!.then(() => true).catch(() => false);
        }));
      }
    }
    
    // Connection in progress, wait a bit and try again
    return timer(1000).pipe(
      switchMap(() => this.ensureConnection())
    );
  }
  
  // Trigger reconnection with proper debouncing
  reconnect(force: boolean = false): void {
    if (this._isConnecting && !force) {
      console.log('Already reconnecting, skipping duplicate request');
      return;
    }
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.authService.isLoggedIn()) {
      console.log('Reconnecting to chat service');
      this._isConnecting = false; // Reset flag to allow new connection
      this.initConnection(force);
    }
  }
  
  // Get list of chat groups
  getUserChatGroups(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/groups`).pipe(
      tap(() => {
        // Refresh unread count after getting groups
        this.updateUnreadCount();
      }),
      catchError(error => {
        console.error('Error fetching user chat groups:', error);
        return of([]);
      }),
      shareReplay(1)
    );
  }
  
  // Clear local user data and cache when logging out
  clearUserData(): void {
    this.closeConnection();
    this.clearCache();
    this._activeGroups = [];
    this.lastLoggedInUserId = null;
    this.unreadMessagesSubject.next(0);
  }

  // Add this method to get unread messages by group
  getUnreadMessagesByGroup(): Observable<{[groupId: string]: number}> {
    if (!this.authService.isLoggedIn()) return of({});
    
    return this.http.get<{[groupId: string]: number}>(`${this.apiUrl}/unread-by-group`).pipe(
      catchError(error => {
        console.error('Error fetching unread messages by group:', error);
        
        // Create a fallback object with counts from cache
        const fallbackCounts: {[groupId: string]: number} = {};
        
        // For each group in the cache, count unread messages
        this.messageCache.forEach((messages, groupId) => {
          fallbackCounts[groupId.toString()] = messages.filter(m => 
            m.senderId !== this.getCurrentUserId() && !m.isRead
          ).length;
        });
        
        return of(fallbackCounts);
      })
    );
  }

  // Add a public method for chat initialization
  ensureChatConnection(): void {
    this.initConnection(true);
  }

  // Add new method for immediate updates
  private updateUnreadCountImmediate(): void {
    if (!this.authService.isLoggedIn()) return;
    
    this.http.get<{count: number}>(`${this.apiUrl}/unread-count`).pipe(
      timeout(2000), // Shorter timeout
      retry(1),
      catchError(error => {
        console.error('Error fetching immediate unread count:', error);
        return of({ count: this.calculateCachedUnreadCount() });
      })
    ).subscribe(result => {
      this.lastKnownUnreadCount = result.count;
      this.unreadMessagesSubject.next(this.lastKnownUnreadCount);
    });
  }

  // Update periodic checks to be more aggressive initially
  private setupAggressivePeriodicChecks(): void {
    // Quick initial checks, then slow down
    concat(
      timer(0, 2000).pipe(take(3)),  // Check every 2 seconds for first 6 seconds
      timer(0, 10000).pipe(take(3)),  // Then every 10 seconds for next 30 seconds
      timer(0, 30000)                 // Then every 30 seconds ongoing
    ).subscribe(() => {
      if (this.authService.isLoggedIn()) {
        if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
          this.updateUnreadCount();
        } else {
          this.updateUnreadCountImmediate();
        }
      }
    });
  }
}