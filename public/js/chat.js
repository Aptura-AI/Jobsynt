// Chat functionality
class JobsyntChat {
    constructor() {
        this.mode = 'floating'; // 'floating' or 'full-page'
        this.initializeElements();
        
        if (this.hasRequiredElements()) {
            this.setupEventListeners();
            this.loadChatHistory();
            this.addWelcomeMessage();
        }
    }

    initializeElements() {
        // Chat elements
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendMessage');
        this.chatMessages = document.querySelector('.chat-messages');
        
        // Floating chat elements
        this.floatingButton = document.getElementById('floatingChatButton');
        this.floatingWindow = document.getElementById('floatingChatWindow');
        this.closeChat = document.querySelector('.close-chat');
        
        // Loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'chat-loading hidden';
        this.loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI is thinking...';
        this.chatMessages?.appendChild(this.loadingIndicator);

        // Check if we're in full-page mode
        const chatSection = document.getElementById('chat-section');
        if (chatSection?.classList.contains('active')) {
            this.mode = 'full-page';
        }
    }

    hasRequiredElements() {
        return this.chatInput && this.sendButton && this.chatMessages;
    }

    setupEventListeners() {
        // Message sending
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Floating chat controls
        if (this.floatingButton && this.floatingWindow) {
            this.floatingButton.addEventListener('click', () => {
                this.floatingWindow.classList.toggle('hidden');
                if (!this.floatingWindow.classList.contains('hidden')) {
                    this.chatInput.focus();
                }
            });
        }

        if (this.closeChat) {
            this.closeChat.addEventListener('click', () => {
                this.floatingWindow.classList.add('hidden');
            });
        }

        // Handle navigation to chat section
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                if (link.getAttribute('data-section') === 'chat-section') {
                    this.mode = 'full-page';
                    // Hide floating elements
                    if (this.floatingButton) this.floatingButton.style.display = 'none';
                    if (this.floatingWindow) this.floatingWindow.style.display = 'none';
                } else if (this.mode === 'full-page') {
                    this.mode = 'floating';
                    // Show floating elements
                    if (this.floatingButton) this.floatingButton.style.display = 'flex';
                    if (this.floatingWindow) this.floatingWindow.style.display = 'flex';
                }
            });
        });
    }

    addWelcomeMessage() {
        const welcomeMessage = `Hello! I'm your AI Career Assistant. I can help you with:
- Career guidance and planning
- Resume and cover letter review
- Job search strategies
- Interview preparation
- Skill development recommendations

How can I assist you today?`;

        this.addMessageToUI(welcomeMessage, false);
    }

    async loadChatHistory() {
        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;

            const { data: messages, error } = await window.supabaseClient
                .from('chat_messages')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })
                .limit(50);

            if (error) throw error;

            // Clear existing messages
            this.chatMessages.innerHTML = '';
            
            // Add loading indicator back
            this.chatMessages.appendChild(this.loadingIndicator);

            // Add messages
            messages?.forEach(msg => this.addMessageToUI(msg.content, msg.is_user));
            
            // Scroll to bottom
            this.scrollToBottom();
        } catch (error) {
            console.error('Error loading chat history:', error);
            this.addMessageToUI('Failed to load chat history. Please refresh the page.', false);
        }
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) throw new Error('No authenticated user');

            // Clear input and add user message
            this.chatInput.value = '';
            this.addMessageToUI(message, true);

            // Show loading indicator
            this.loadingIndicator.classList.remove('hidden');
            this.scrollToBottom();

            // Save user message
            await this.saveMessage(user.id, message, true);

            // Get AI response
            const response = await this.getAIResponse(message, user.id);
            
            // Hide loading indicator
            this.loadingIndicator.classList.add('hidden');
            
            // Add AI response to UI
            this.addMessageToUI(response, false);
            
            // Save AI response
            await this.saveMessage(user.id, response, false);
        } catch (error) {
            console.error('Error sending message:', error);
            this.loadingIndicator.classList.add('hidden');
            this.addMessageToUI('Sorry, I encountered an error. Please try again.', false);
        }
    }

    async getAIResponse(message, userId) {
        try {
            // Get user profile for context
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    profile
                })
            });

            if (!response.ok) throw new Error('Chat request failed');

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Error getting AI response:', error);
            throw error;
        }
    }

    async saveMessage(userId, content, isUser) {
        try {
            const { error } = await window.supabaseClient
                .from('chat_messages')
                .insert({
                    user_id: userId,
                    content,
                    is_user: isUser,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
        } catch (error) {
            console.error('Error saving message:', error);
        }
    }

    addMessageToUI(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user-message' : 'ai-message'}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-avatar">
                    ${isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>'}
                </div>
                <div class="message-text">${this.formatMessage(message)}</div>
            </div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;

        this.chatMessages.insertBefore(messageDiv, this.loadingIndicator);
        this.scrollToBottom();
    }

    formatMessage(message) {
        // Convert URLs to links
        message = message.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank">$1</a>'
        );

        // Convert markdown-style links
        message = message.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank">$1</a>'
        );

        // Convert code blocks
        message = message.replace(
            /`([^`]+)`/g,
            '<code>$1</code>'
        );

        // Convert newlines to <br>
        message = message.replace(/\n/g, '<br>');

        return message;
    }

    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
}

// Initialize chat when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.jobsyntChat = new JobsyntChat();
}); 