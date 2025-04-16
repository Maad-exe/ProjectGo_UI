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
  hasLoadedInitialMessages: boolean = false;
  
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
    this.userId = this.authService.getUserId();
    
    this.chatService.connected$.subscribe(connected => {
      this.isConnected = connected;
      
      if (connected && this.groupId && !this.hasLoadedInitialMessages) {
        this.loadMessages();
        this.hasLoadedInitialMessages = true;
      }
    });
    
    this.chatService.ensureChatConnection();
    
    if (this.groupId) {
      this.loadMessages();
    }
    
    this.loadUserInfo();
    
    console.log('Chat component initialized, connecting to chat service...');
    
    this.chatService.connected$.pipe(
      filter(connected => connected === true),
      take(1),
      timeout(30000) // 3 seconds timeout
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
    
    this.chatService.reconnect();
    
    this.subscriptions.push(
      this.typingSubject.pipe(
        debounceTime(1000),
        distinctUntilChanged()
      ).subscribe(message => {
        if (message && this.groupId) {
          this.notifyTyping();
        }
      })
    );
  }
  
  ngAfterViewChecked(): void {
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
    
    this.subscriptions.push(
      this.chatService.connected$.subscribe((connected: boolean) => {
        this.isConnected = connected;
        
        if (connected && this.groupId) {
          this.chatService.joinGroup(this.groupId);
        }
      })
    );
    
    this.subscriptions.push(
      this.chatService.messageReceived$.subscribe((message: ChatMessage) => {
        if (message.groupId === this.groupId) {
          this.addMessage(message);
        }
      })
    );
    
    this.subscriptions.push(
      this.chatService.userTyping$.subscribe((typingInfo: UserTypingInfo) => {
        if (typingInfo.groupId === this.groupId && typingInfo.userId !== this.userId) {
          this.handleUserTyping(typingInfo);
        }
      })
    );
    
    // Fix the messageRead$ subscription to properly update the UI
    this.subscriptions.push(
      this.chatService.messageRead$.subscribe((info: {userId: number, userName?: string, groupId: number}) => {
        if (info.groupId === this.groupId) {
          console.log(`User ${info.userName || 'Unknown'} (ID: ${info.userId}) read messages in group ${info.groupId}`);
          this.updateMessagesReadStatus(info.userId, info.userName);
        }
      })
    );
    
    this.loadMessages();
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
    
    this.error = null;
    
    let before: Date | undefined = undefined;
    if (loadEarlier && this.oldestMessageTimestamp) {
      before = new Date(this.oldestMessageTimestamp);
    }
    
    console.log(`Loading messages for group ${this.groupId}, before:`, before);
    
    this.chatService.getGroupMessages(this.groupId, this.messagesPerPage, before).subscribe({
      next: (messages: ChatMessage[]) => {
        console.log(`Loaded ${messages.length} messages for group ${this.groupId}`);
        
        if (loadEarlier) {
          this.handleEarlierMessages(messages);
        } else {
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
      this.oldestMessageTimestamp = new Date(messages[0].timestamp);
      this.messages = [...messages, ...this.messages];
    }
  }
  
  addMessage(message: ChatMessage): void {
    if (!message.readBy) {
      message.readBy = [];
    }
    
    if (message.senderId === this.userId) {
      const tempIndex = this.messages.findIndex(m => 
        m.id < 0 && 
        m.senderId === this.userId && 
        m.content === message.content &&
        Math.abs(new Date(m.timestamp).getTime() - new Date(message.timestamp).getTime()) < 30000
      );
      
      if (tempIndex >= 0) {
        this.messages[tempIndex] = message;
        return;
      }
    }
    
    const existingMessage = this.messages.find(m => m.id === message.id && m.id > 0);
    if (existingMessage) return;
    
    this.messages.push(message);
    
    if (message.senderId === this.userId) {
      message.isRead = true;
    } else {
      this.markMessagesAsRead();
    }
    
    if (this.chatMessagesContainer) {
      const element = this.chatMessagesContainer.nativeElement;
      const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
      
      this.scrollToBottomPending = true;
      if (atBottom) {
        this.scrollToBottom();
      }
    }
  }
  
  getReadStatus(message: ChatMessage): string {
    if (!message || message.senderId !== this.userId) {
      return '';
    }
  
    if (!message.readBy) {
      message.readBy = [];
    }
  
    if (message.readBy.length === 0) {
      return 'Sent';
    }
  
    const readers = message.readBy
      .filter(r => r.userId !== message.senderId && r.userName)
      .map(r => r.userName || `User ${r.userId}`);
  
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
  
  markMessagesAsRead(): void {
    if (!this.groupId) return;
    
    this.chatService.markMessagesAsRead(this.groupId).subscribe({
      next: () => {
        console.log('Messages marked as read');
        
        this.messages.forEach(message => {
          if (message.senderId !== this.userId) {
            message.isRead = true;
            message.isReadByCurrentUser = true;
            
            if (!message.readBy?.some(r => r.userId === this.userId)) {
              message.readBy = message.readBy || [];
              
              let currentUserName = 'You';
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
  
  updateMessagesReadStatus(userId: number, userName?: string): void {
    let resolvedUserName = userName;
    
    if (!resolvedUserName) {
      const userMessage = this.messages.find(m => m.senderId === userId);
      if (userMessage && userMessage.senderName) {
        resolvedUserName = userMessage.senderName;
      } else {
        resolvedUserName = `User ${userId}`;
      }
    }
    
    let messagesUpdated = false;
    
    // Create a new array to force change detection
    const updatedMessages = this.messages.map(message => {
      // Only update messages sent by the current user
      if (message.senderId === this.userId) {
        const existingReader = message.readBy?.find(r => r.userId === userId);
        if (!existingReader && message.readBy) {
          // Create a new message object with the updated readBy array
          const newMessage = { ...message };
          newMessage.readBy = [
            ...message.readBy,
            {
              userId: userId,
              userName: resolvedUserName,
              readAt: new Date().toISOString()
            }
          ];
          newMessage.totalReadCount = newMessage.readBy.length;
          messagesUpdated = true;
          return newMessage;
        } else if (existingReader && (!existingReader.userName || existingReader.userName === `User ${userId}`) && resolvedUserName) {
          // Create a new message object with the updated reader name
          const newMessage = { ...message };
          newMessage.readBy = message.readBy.map(reader => {
            if (reader.userId === userId) {
              return { ...reader, userName: resolvedUserName };
            }
            return reader;
          });
          messagesUpdated = true;
          return newMessage;
        }
      }
      return message;
    });
    
    // If we updated messages, set the new array
    if (messagesUpdated) {
      console.log('Messages updated with new read receipts');
      this.messages = updatedMessages;
    }
  }
  
  handleUserTyping(typingInfo: UserTypingInfo): void {
    if (typingInfo.userId === this.userId) return;
    
    if (this.typingTimeouts.has(typingInfo.userId)) {
      clearTimeout(this.typingTimeouts.get(typingInfo.userId));
    }

    this.typingUsers.set(typingInfo.userId, {
      name: typingInfo.userName,
      timestamp: new Date()
    });

    const timeout = setTimeout(() => {
      this.typingUsers.delete(typingInfo.userId);
      this.typingTimeouts.delete(typingInfo.userId);
      this.updateTypingIndicator();
    }, 3000);

    this.typingTimeouts.set(typingInfo.userId, timeout);
    this.updateTypingIndicator();
  }
  
  updateTypingIndicator(): void {
    if (this.typingUsers.size === 0) {
      this.showTypingIndicator = false;
      this.typingText = '';
      return;
    }

    this.showTypingIndicator = true;
    const typingUserNames = Array.from(this.typingUsers.values())
      .map(user => user.name.split(' ')[0])
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
    
    this.chatService.notifyTyping(this.groupId);
  }
  
  notifyUserTyping(message: string): void {
    if (!this.groupId || !message) return;
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.chatService.notifyTyping(this.groupId);
    
    this.typingTimeout = setTimeout(() => {
      this.chatService.stopTypingNotification(this.groupId);
      this.typingTimeout = null;
    }, this.typingDebounceTime);
  }
  
  sendMessage(): void {
    if (!this.groupId || !this.newMessage.trim()) return;
    
    const messageContent = this.newMessage.trim();
    this.newMessage = '';
    
    const tempMessage: ChatMessage = {
      id: -new Date().getTime(),
      groupId: this.groupId,
      senderId: this.userId!,
      senderName: 'You',
      senderRole: this.userRole,
      content: messageContent,
      timestamp: new Date().toISOString(),
      isRead: false,
      readBy: [],
      totalReadCount: 0,
      isReadByCurrentUser: true
    };
    
    this.messages.push(tempMessage);
    this.scrollToBottomPending = true;
    
    this.chatService.sendMessage(this.groupId, messageContent).subscribe({
      next: () => {
        console.log('Message sent successfully');
        if (this.messageInput) {
          this.messageInput.nativeElement.focus();
        }
      },
      error: (error: Error) => {
        console.error('Error sending message:', error);
        
        this.messages = this.messages.filter(m => m.id !== tempMessage.id);
        
        this.newMessage = messageContent;
        this.notificationService.showError('Failed to send message. Please try again.');
      }
    });
  }
  
  scrollToBottom(): void {
    try {
      if (this.chatMessagesContainer) {
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
    this.subscriptions.forEach(sub => sub.unsubscribe());
    
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

  getDetailedReadStatus(message: ChatMessage): string {
    if (!message.readBy) {
      message.readBy = [];
    }

    if (message.readBy.length === 0) {
      return 'Not read by anyone yet';
    }

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