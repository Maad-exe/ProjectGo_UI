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
  typingUsers: Map<number, UserTypingInfo> = new Map();
  showTypingIndicator: boolean = false;
  typingText: string = '';
  loadingEarlierMessages: boolean = false;
  noMoreMessages: boolean = false;
  oldestMessageTimestamp: Date | null = null;
  messagesPerPage: number = 20;
  
  private subscriptions: Subscription[] = [];
  private typingSubject = new BehaviorSubject<string>('');
  private scrollToBottomPending = false;
  
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
    if (this.scrollToBottomPending) {
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
    
    this.scrollToBottomPending = true;
  }
  
  markMessagesAsRead(): void {
    if (!this.groupId) return;
    
    this.chatService.markMessagesAsRead(this.groupId).subscribe({
      next: () => console.log('Messages marked as read'),
      error: err => console.error('Error marking messages as read:', err)
    });
  }
  
  updateMessagesReadStatus(userId: number): void {
    this.messages.forEach(message => {
      if (message.senderId === this.userId) {
        message.isRead = true;
      }
    });
  }
  
  handleUserTyping(typingInfo: UserTypingInfo): void {
    this.typingUsers.set(typingInfo.userId, typingInfo);
    this.updateTypingIndicator();
    
    // Remove typing indicator after a delay
    setTimeout(() => {
      this.typingUsers.delete(typingInfo.userId);
      this.updateTypingIndicator();
    }, 3000);
  }
  
  updateTypingIndicator(): void {
    if (this.typingUsers.size === 0) {
      this.showTypingIndicator = false;
      return;
    }
    
    this.showTypingIndicator = true;
    
    if (this.typingUsers.size === 1) {
      const typingUser = Array.from(this.typingUsers.values())[0];
      this.typingText = `${typingUser.userName} is typing...`;
    } else {
      this.typingText = `${this.typingUsers.size} people are typing...`;
    }
  }
  
  notifyTyping(): void {
    if (!this.groupId) return;
    
    // Call the notifyTyping method we added to ChatService
    this.chatService.notifyTyping(this.groupId);
  }
  
  // Public method to notify typing
  notifyUserTyping(message: string): void {
    this.typingSubject.next(message);
  }
  
  sendMessage(): void {
    if (!this.groupId || !this.newMessage.trim()) return;
    
    const messageContent = this.newMessage.trim();
    this.newMessage = ''; // Clear input immediately for better UX
    
    // Create a temporary message to show immediately
    const tempMessage: ChatMessage = {
      id: -new Date().getTime(), // Temporary negative ID to identify it
      groupId: this.groupId,
      senderId: this.userId!,
      senderName: 'You', // Will be replaced when the real message arrives
      senderRole: this.userRole,
      content: messageContent,
      timestamp: new Date().toISOString(),
      isRead: false
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
  
  scrollToBottom(): void {
    if (this.chatMessagesContainer) {
      const element = this.chatMessagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
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
}
