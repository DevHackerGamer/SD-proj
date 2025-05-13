import React from 'react';
import styles from './MetadataModal.module.css';
import { FaInfoCircle } from 'react-icons/fa';

const ThematicFocusHelp: React.FC = () => {
  return (
    <div className={styles.helpContainer}>
      <h4><FaInfoCircle /> Thematic Focus Categories</h4>
      <div className={styles.helpContent}>
        <div className={styles.themeCategory}>
          <h5>Human Rights</h5>
          <ul>
            <li>Bill of Rights</li>
            <li>Socio-Economic Rights</li>
            <li>LGBTQ+ Protections</li>
          </ul>
        </div>
        
        <div className={styles.themeCategory}>
          <h5>Land Reform</h5>
          <ul>
            <li>Expropriation</li>
            <li>Restitution</li>
            <li>Section 25 discussions</li>
          </ul>
        </div>
        
        <div className={styles.themeCategory}>
          <h5>Transitional Justice</h5>
          <ul>
            <li>TRC Testimonies</li>
            <li>Amnesty Hearings</li>
            <li>Reparations</li>
          </ul>
        </div>
        
        <div className={styles.themeCategory}>
          <h5>Constitutional Drafting</h5>
          <ul>
            <li>Multi-Party Negotiations</li>
            <li>Public Consultations</li>
            <li>Finalization Stages</li>
          </ul>
        </div>
        
        <div className={styles.themeCategory}>
          <h5>Security Laws</h5>
          <ul>
            <li>RICA</li>
            <li>State Surveillance</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ThematicFocusHelp;
