import React from 'react';
import type { FileSystemItem } from '../types';
import '../styles.css';

interface DeleteConfirmationModalProps {
  itemsToDelete: FileSystemItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  itemsToDelete,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="modal-overlay">
      <div className="confirmation-modal">
        <h2>Confirm Deletion</h2>
        
        <div className="modal-content">
          <p>
            Are you sure you want to delete the following {itemsToDelete.length > 1 ? 'items' : 'item'}?
            This action cannot be undone.
          </p>
          
          <ul className="items-to-delete">
            {itemsToDelete.map(item => (
              <li key={item.id}>
                <span className="item-icon">{item.isDirectory ? '📁' : '📄'}</span>
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="delete-button" 
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;