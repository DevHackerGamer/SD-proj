import React from 'react';
import { FaHistory, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import styles from '../BasicFileSystem.module.css';

interface NavigationHistoryProps {
  history: string[];
  currentIndex: number;
  onNavigate: (path: string) => void;
  onBack: () => void;
  onForward: () => void;
}

const NavigationHistory: React.FC<NavigationHistoryProps> = ({
  history,
  currentIndex,
  onNavigate,
  onBack,
  onForward
}) => {
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  return (
    <div className={styles.navHistoryContainer}>
      <button 
        className={styles.navHistoryButton} 
        onClick={onBack}
        disabled={!canGoBack}
        title="Go Back"
      >
        <FaArrowLeft />
      </button>
      <button 
        className={styles.navHistoryButton} 
        onClick={onForward}
        disabled={!canGoForward}
        title="Go Forward"
      >
        <FaArrowRight />
      </button>
      <div className={styles.navHistoryDropdown}>
        <button className={styles.navHistoryDropButton} title="History">
          <FaHistory />
        </button>
        <div className={styles.navHistoryDropdownContent}>
          {history.map((path, index) => (
            <button 
              key={`history-${index}`}
              className={`${styles.historyItem} ${index === currentIndex ? styles.currentHistoryItem : ''}`}
              onClick={() => onNavigate(path)}
            >
              {path || 'Root'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NavigationHistory;
