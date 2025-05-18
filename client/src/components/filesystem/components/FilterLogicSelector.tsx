import React from 'react';
import { FaInfoCircle } from 'react-icons/fa';
import styles from './FilterLogicSelector.module.css';

type FilterLogicSelectorProps = {
  filterLogic: 'AND' | 'OR';
  onChange: (logic: 'AND' | 'OR') => void;
  disabled?: boolean;
  className?: string;
};

const FilterLogicSelector: React.FC<FilterLogicSelectorProps> = ({
  filterLogic,
  onChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`${styles.logicSelectorContainer} ${className}`}>
      <div className={styles.logicSelectorLabel}>
        Filter Logic
        <div className={styles.tooltipContainer}>
          <FaInfoCircle className={styles.infoIcon} />
          <div className={styles.tooltip}>
            Choose how multiple filters are combined:
            <br />
            <strong>AND:</strong> All criteria must match (more specific)
            <br />
            <strong>OR:</strong> Any criteria can match (broader results)
          </div>
        </div>
      </div>

      <div className={styles.buttonGroup}>
        <button
          className={`${styles.logicButton} ${styles.andButton} ${filterLogic === 'AND' ? styles.active : ''}`}
          onClick={() => !disabled && onChange('AND')}
          disabled={disabled}
          aria-pressed={filterLogic === 'AND'}
        >
          <span>AND</span>
          <span className={styles.buttonDescription}>Match all criteria</span>
        </button>
        <button
          className={`${styles.logicButton} ${styles.orButton} ${filterLogic === 'OR' ? styles.active : ''}`}
          onClick={() => !disabled && onChange('OR')}
          disabled={disabled}
          aria-pressed={filterLogic === 'OR'}
        >
          <span>OR</span>
          <span className={styles.buttonDescription}>Match any criteria</span>
        </button>
      </div>
      
      <div className={styles.exampleText}>
        {filterLogic === 'AND' ? 
          "Example: Documents about both \"Land Reform\" AND \"Gauteng\"" : 
          "Example: Documents about either \"Land Reform\" OR \"Gauteng\""}
      </div>
    </div>
  );
};

export default FilterLogicSelector;
