import { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import './ChatWindow.css';

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { chatAPI } = await import('../api/client');
      const response = await chatAPI.sendMessage(message);

      // Add assistant response
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.response,
        sql: response.sql,
        data: response.data,
        error: response.error,
        executionTime: response.execution_time,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        error: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-window">
      <div className={`chat-messages-container ${hasMessages ? 'has-messages' : ''}`}>
        <MessageList messages={messages} isLoading={isLoading} hasInput={!hasMessages} />
        <div ref={messagesEndRef} />
      </div>
      <MessageInput 
        onSendMessage={handleSendMessage} 
        disabled={isLoading} 
        isInEmptyState={!hasMessages}
      />
    </div>
  );
};

export default ChatWindow;
