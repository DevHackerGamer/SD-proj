import React from 'react';
import styles from '../BasicFileSystem.module.css'; // Use parent's styles

interface NavigationBarProps {
  currentPath: string;
  isLoading: boolean;
  onNavigateUp: () => void;
}

const NavigationBar: React.FC<NavigationBarProps> = ({ currentPath, isLoading, onNavigateUp }) => {
  return (
    <div className={styles.navigation}>
      <button onClick={onNavigateUp} disabled={!currentPath || isLoading}>
        Up ../
      </button>
      <span>Current Path: /{currentPath}</span>
    </div>
  );
};

export default NavigationBar;
