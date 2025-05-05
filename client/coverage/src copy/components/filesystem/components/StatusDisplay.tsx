import React from 'react';
import styles from '../BasicFileSystem.module.css'; // Use parent's styles

interface StatusDisplayProps {
  isLoading: boolean;
  error: string | null;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ isLoading, error }) => {
  if (isLoading) {
    return <div className={styles.loading}>Loading items...</div>;
  }
  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }
  return null; // Render nothing if no loading or error
};

export default StatusDisplay;
