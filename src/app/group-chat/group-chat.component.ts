import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Input, AfterViewChecked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, UserTypingInfo } from '../services/chat.service';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notifications.service';
import { Subscription, BehaviorSubject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, take, timeout } from 'rxjs/operators';

@Component({
  selector: 'app-group-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './group-chat.component.html',
  styleUrls: ['./group-chat.component.scss']
})
export class GroupChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatMessages') chatMessagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;
  @Input() groupId!: number;
  @Input() groupName: string = '';
  
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  userRole: string = '';
  userId: number | null = null;
  isConnected: boolean = false;
  typingUsers: Map<number, {name: string; timestamp: Date}> = new Map();
  showTypingIndicator: boolean = false;
  typingText: string = '';
  loadingEarlierMessages: boolean = false;
  noMoreMessages: boolean = false;
  oldestMessageTimestamp: Date | null = null;
  messagesPerPage: number = 20;
  
  private subscriptions: Subscription[] = [];
  private typingSubject = new BehaviorSubject<string>('');
  private scrollToBottomPending = false;
  private typingTimeout: any;
  private typingDebounceTime = 1000; // 1 second
  private typingTimeouts: Map<number, any> = new Map();
  
  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}
  
  ngOnInit(): void {
    this.loadUserInfo();
    
    console.log('Chat component initialized, connecting to chat service...');
    
    // Replace the timeout chaining with a more reliable approach
    this.chatService.connected$.pipe(
      filter(connected => connected === true),
      take(1),
      timeout(10000) // 10 seconds timeout
    ).subscribe({
      next: () => {
        console.log('Connection established, setting up chat service');
        this.setupChatService();
      },
      error: () => {
        console.error('Failed to establish connection within timeout');
        this.error = 'Failed to connect to chat service. Please try refreshing the page.';
      }
    });
    
    // Trigger a single reconnection attempt
    this.chatService.reconnect();
    
    // Setup typing notification throttling
    this.subscriptions.push(
      this.typingSubject.pipe(
        debounceTime(1000), // Only emit if there's a 1s pause
        distinctUntilChanged()
      ).subscribe(message => {
        if (message && this.groupId) {
          this.notifyTyping();
        }
      })
    );
  }
  
  ngAfterViewChecked(): void {
    // Only scroll if explicitly marked as pending
    if (this.scrollToBottomPending && this.messages.length > 0) {
      this.scrollToBottom();
      this.scrollToBottomPending = false;
    }
  }
  
  loadUserInfo(): void {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const payload = this.authService.decodeToken(token);
    this.userRole = payload.role;
    this.userId = Number(payload.UserId);
  }
  
  setupChatService(): void {
    if (!this.groupId) return;
    
    // Subscribe to connection status changes
    this.subscriptions.push(
      this.chatService.connected$.subscribe((connected: boolean) => {
        this.isConnected = connected;
        
        // When connected, join the group
        if (connected && this.groupId) {
          this.chatService.joinGroup(this.groupId);
        }
      })
    );
    
    // Subscribe to new messages
    this.subscriptions.push(
      this.chatService.messageReceived$.subscribe((message: ChatMessage) => {
        if (message.groupId === this.groupId) {
          this.addMessage(message);
        }
      })
    );
    
    // Subscribe to typing notifications
    this.subscriptions.push(
      this.chatService.userTyping$.subscribe((typingInfo: UserTypingInfo) => {
        if (typingInfo.groupId === this.groupId && typingInfo.userId !== this.userId) {
          this.handleUserTyping(typingInfo);
        }
      })
    );
    
    // Subscribe to messages read notifications
    this.subscriptions.push(
      this.chatService.messageRead$.subscribe((info: {userId: number, groupId: number}) => {
        if (info.groupId === this.groupId) {
          this.updateMessagesReadStatus(info.userId);
        }
      })
    );
    
    // Load initial messages
    this.loadMessages();
    
    // Mark messages as read when opening chat
    this.markMessagesAsRead();
  }
  
  loadMessages(loadEarlier: boolean = false): void {
    if (!this.groupId) return;
    
    if (loadEarlier) {
      if (this.loadingEarlierMessages || this.noMoreMessages) return;
      this.loadingEarlierMessages = true;
    } else {
      this.isLoading = true;
    }
    
    // Clear errors
    this.error = null;
    
    // Prepare parameters for loading messages
    let before: Date | undefined = undefined;
    if (loadEarlier && this.oldestMessageTimestamp) {
      before = new Date(this.oldestMessageTimestamp);
    }
    
    // Add logging to debug the issue
    console.log(`Loading messages for group ${this.groupId}, before:`, before);
    
    this.chatService.getGroupMessages(this.groupId, this.messagesPerPage, before).subscribe({
      next: (messages: ChatMessage[]) => {
        console.log(`Loaded ${messages.length} messages for group ${this.groupId}`);
        
        if (loadEarlier) {
          this.handleEarlierMessages(messages);
        } else {
          // Remove any temporary messages if they exist
          this.messages = messages.filter(msg => msg.id > 0);
          
          if (messages.length > 0) {
            this.oldestMessageTimestamp = new Date(messages[0].timestamp);
          }
          this.markMessagesAsRead();
          this.scrollToBottomPending = true;
        }
        
        this.isLoading = false;
        this.loadingEarlierMessages = false;
      },
      error: (error: any) => {
        console.error('Failed to load messages:', error);
        this.error = 'Failed to load chat messages';
        this.isLoading = false;
        this.loadingEarlierMessages = false;
      }
    });
  }
  
  handleEarlierMessages(messages: ChatMessage[]): void {
    if (messages.length === 0) {
      this.noMoreMessages = true;
      return;
    }
    
    if (messages.length > 0) {
      // Update oldest timestamp for pagination
      this.oldestMessageTimestamp = new Date(messages[0].timestamp);
      
      // Prepend messages to the beginning of the array
      this.messages = [...messages, ...this.messages];
    }
  }
  
  addMessage(message: ChatMessage): void {
    // Make sure readBy is never undefined
    if (!message.readBy) {
      message.readBy = [];
    }
    
    // Check if this is a message from the current user that would replace a temp message
    if (message.senderId === this.userId) {
      // Look for temporary messages with the same content and approximately the same time
      const tempIndex = this.messages.findIndex(m => 
        m.id < 0 && 
        m.senderId === this.userId && 
        m.content === message.content &&
        Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 30000 // Within 30 seconds
      );
      
      if (tempIndex >= 0) {
        // Replace the temporary message with the real one
        this.messages[tempIndex] = message;
        return;
      }
    }
    
    // For non-replacement cases, proceed as normal:
    // Check if the message is already in the list to avoid duplicates
    const existingMessage = this.messages.find(m => m.id === message.id && m.id > 0); // Only check positive IDs
    if (existingMessage) return;
    
    this.messages.push(message);
    
    // Mark our own messages as read when they are added
    if (message.senderId === this.userId) {
      message.isRead = true;
    } else {
      // Mark other people's messages as read since we just received them
      this.markMessagesAsRead();
    }
    
    // Check if user was near bottom before receiving the message
    if (this.chatMessagesContainer) {
      const element = this.chatMessagesContainer.nativeElement;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
      
      // For immediate receiving of messages (not during initial load)
      // Always set scroll pending for new messages, but scroll immediately if at bottom
      this.scrollToBottomPending = true;
      if (atBottom) {
        this.scrollToBottom(); // Scroll immediately if user was at bottom
      }
    }
  }
  
  // Fix the undefined username issue in the getReadStatus method
  getReadStatus(message: ChatMessage): string {
    if (!message || message.senderId !== this.userId) {
      return ''; // Don't show read status for other's messages
    }
  
    // Initialize readBy if it's undefined
    if (!message.readBy) {
      message.readBy = [];
    }
  
    if (message.readBy.length === 0) {
      return 'Sent';
    }
  
    // Filter out the sender from readers, and ensure we have valid usernames
    const readers = message.readBy
      .filter(r => r.userId !== message.senderId && r.userName)
      .map(r => r.userName || `User ${r.userId}`); // Fallback name if undefined
  
    if (readers.length === 0) {
      return 'Sent';
    } else if (readers.length === 1) {
      return `Read by ${readers[0]}`;
    } else if (readers.length === 2) {
      return `Read by ${readers[0]} and ${readers[1]}`;
    } else if (readers.length === 3) {
      return `Read by ${readers[0]}, ${readers[1]} and ${readers[2]}`;
    } else {
      return `Read by ${readers[0]}, ${readers[1]} and ${readers.length - 2} others`;
    }
  }
  
  // Enhance the markMessagesAsRead method to update UI and handle undefined names
  markMessagesAsRead(): void {
    if (!this.groupId) return;
    
    this.chatService.markMessagesAsRead(this.groupId).subscribe({
      next: () => {
        console.log('Messages marked as read');
        
        // Update local UI to show messages as read
        this.messages.forEach(message => {
          if (message.senderId !== this.userId) {
            message.isRead = true;
            message.isReadByCurrentUser = true;
            
            // Add current user to readBy if not already there
            if (!message.readBy?.some(r => r.userId === this.userId)) {
              message.readBy = message.readBy || [];
              
              // Get current user's full name from local storage or any message they've sent
              let currentUserName = 'You'; // Default
              const ownMessage = this.messages.find(m => m.senderId === this.userId);
              if (ownMessage && ownMessage.senderName) {
                currentUserName = ownMessage.senderName;
              }
              
              message.readBy.push({
                userId: this.userId!,
                userName: currentUserName,
                readAt: new Date().toISOString()
              });
              message.totalReadCount = message.readBy.length;
            }
          }
        });
      },
      error: err => console.error('Error marking messages as read:', err)
    });
  }
  
  // Update the updateMessagesReadStatus method to handle undefined usernames
  updateMessagesReadStatus(userId: number, userName?: string): void {
    // If userName is undefined, try to find it from other messages
    let resolvedUserName = userName;
    
    if (!resolvedUserName) {
      // Look for this user's name in other messages where they were the sender
      const userMessage = this.messages.find(m => m.senderId === userId);
      if (userMessage && userMessage.senderName) {
        resolvedUserName = userMessage.senderName;
      } else {
        resolvedUserName = `User ${userId}`; // Fallback
      }
    }
    
    this.messages.forEach(message => {
      if (message.senderId === this.userId) {
        // Update the readBy array
        const existingReader = message.readBy?.find(r => r.userId === userId);
        if (!existingReader && message.readBy) {
          message.readBy.push({
            userId: userId,
            userName: resolvedUserName, // Use resolved name
            readAt: new Date().toISOString()
          });
          message.totalReadCount = message.readBy.length;
        } else if (existingReader && !existingReader.userName && resolvedUserName) {
          // Update the name if it was previously undefined
          existingReader.userName = resolvedUserName;
        }
      }
    });
  }
  
  handleUserTyping(typingInfo: UserTypingInfo): void {
    if (typingInfo.userId === this.userId) return; // Don't show own typing indicator
    
    // Clear existing timeout for this user if any
    if (this.typingTimeouts.has(typingInfo.userId)) {
      clearTimeout(this.typingTimeouts.get(typingInfo.userId));
    }

    // Add/Update typing user
    this.typingUsers.set(typingInfo.userId, {
      name: typingInfo.userName,
      timestamp: new Date()
    });

    // Set timeout to remove typing indicator
    const timeout = setTimeout(() => {
      this.typingUsers.delete(typingInfo.userId);
      this.typingTimeouts.delete(typingInfo.userId);
      this.updateTypingIndicator();
    }, 3000);

    this.typingTimeouts.set(typingInfo.userId, timeout);
    this.updateTypingIndicator();
  }
  
  // Update the updateTypingIndicator method for more personalized messages
  updateTypingIndicator(): void {
    if (this.typingUsers.size === 0) {
      this.showTypingIndicator = false;
      this.typingText = '';
      return;
    }

    this.showTypingIndicator = true;
    const typingUserNames = Array.from(this.typingUsers.values())
      .map(user => user.name.split(' ')[0]) // Only use first name for cleaner display
      .sort();

    if (typingUserNames.length === 1) {
      this.typingText = `${typingUserNames[0]} is typing...`;
    } else if (typingUserNames.length === 2) {
      this.typingText = `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
    } else if (typingUserNames.length === 3) {
      this.typingText = `${typingUserNames[0]}, ${typingUserNames[1]} and ${typingUserNames[2]} are typing...`;
    } else {
      this.typingText = `${typingUserNames.length} people are typing...`;
    }
  }
  
  notifyTyping(): void {
    if (!this.groupId) return;
    
    // Call the notifyTyping method we added to ChatService
    this.chatService.notifyTyping(this.groupId);
  }
  
  // Update to properly handle typing notifications
  notifyUserTyping(message: string): void {
    if (!this.groupId || !message) return;
    
    // Clear existing timeout for this user
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Send typing notification
    this.chatService.notifyTyping(this.groupId);
    
    // Set new timeout
    this.typingTimeout = setTimeout(() => {
      this.chatService.stopTypingNotification(this.groupId);
      this.typingTimeout = null;
    }, this.typingDebounceTime);
  }
  
  sendMessage(): void {
    if (!this.groupId || !this.newMessage.trim()) return;
    
    const messageContent = this.newMessage.trim();
    this.newMessage = ''; // Clear input immediately for better UX
    
    // Create a temporary message to show immediately
    const tempMessage: ChatMessage = {
      id: -new Date().getTime(), // Temporary negative ID
      groupId: this.groupId,
      senderId: this.userId!,
      senderName: 'You',
      senderRole: this.userRole,
      content: messageContent,
      timestamp: new Date().toISOString(),
      isRead: false,
      readBy: [], // Initialize empty array
      totalReadCount: 0, // Add missing property
      isReadByCurrentUser: true // Add missing property - true since it's our message
    };
    
    // Add the temporary message to the UI
    this.messages.push(tempMessage);
    this.scrollToBottomPending = true;
    
    this.chatService.sendMessage(this.groupId, messageContent).subscribe({
      next: () => {
        console.log('Message sent successfully');
        // The actual message with server ID will come through the SignalR connection
        if (this.messageInput) {
          this.messageInput.nativeElement.focus();
        }
      },
      error: (error: Error) => {
        console.error('Error sending message:', error);
        
        // Remove the temporary message since sending failed
        this.messages = this.messages.filter(m => m.id !== tempMessage.id);
        
        // Keep the message content in the input field
        this.newMessage = messageContent;
        this.notificationService.showError('Failed to send message. Please try again.');
      }
    });
  }
  
  // Improve scrollToBottom method to be more reliable
  scrollToBottom(): void {
    try {
      if (this.chatMessagesContainer) {
        // Use requestAnimationFrame for smoother scrolling that happens after DOM rendering
        requestAnimationFrame(() => {
          const element = this.chatMessagesContainer.nativeElement;
          element.scrollTop = element.scrollHeight;
        });
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
  
  ngOnDestroy(): void {
    // Clear all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
    // Leave the chat group
    if (this.groupId) {
      this.chatService.leaveGroup(this.groupId).subscribe({
        next: (success) => console.log('Left chat group successfully:', success),
        error: (err) => console.error('Error leaving chat group:', err)
      });
    }
  }

  isLastMessageFromUser(currentMessage: ChatMessage, userId: number): boolean {
    const index = this.messages.findIndex(msg => msg === currentMessage);
    const laterMessages = this.messages.slice(index + 1);
    return !laterMessages.some(msg => msg.senderId === userId);
  }

  // Fix the detailed read status method too
  getDetailedReadStatus(message: ChatMessage): string {
    // Initialize readBy if it's undefined
    if (!message.readBy) {
      message.readBy = [];
    }

    if (message.readBy.length === 0) {
      return 'Not read by anyone yet';
    }

    // Filter out sender and invalid usernames, sort by read time
    const readers = message.readBy
      .filter(r => r.userId !== message.senderId && r.userName)
      .sort((a, b) => new Date(a.readAt).getTime() - new Date(b.readAt).getTime())
      .map(r => `${r.userName || `User ${r.userId}`} (${new Date(r.readAt).toLocaleTimeString()})`);

    if (readers.length === 0) {
      return 'Not read by anyone yet';
    }

    return `Read by:\n${readers.join('\n')}`;
  }
}