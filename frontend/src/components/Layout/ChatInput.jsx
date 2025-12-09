import React from 'react';

const ChatInput = ({ 
  inputValue, 
  onInputChange, 
  onSendMessage, 
  onAttachFile, 
  fileInputRef,
  isDisabled,
  placeholder 
}) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="chat-input-container">
      <div className="input-wrapper">
        <textarea 
          id="userInput"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          rows="1"
          disabled={isDisabled}
        ></textarea>
        <div className="input-actions">
          <button 
            className="action-btn attach-btn" 
            onClick={onAttachFile}
            title="Adjuntar archivo"
            disabled={isDisabled}
          >
            <i className="fas fa-paperclip"></i>
          </button>
          <button 
            className="action-btn send-btn" 
            onClick={onSendMessage}
            title="Enviar Mensaje"
            disabled={!inputValue.trim() || isDisabled}
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
      
      {/* Input oculto para archivos */}
      <input 
        type="file" 
        ref={fileInputRef}
        multiple 
        style={{ display: 'none' }} 
        accept=".txt,.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx,.xls,.xlsx,.zip,.rar"
      />
    </div>
  );
};

export default ChatInput;