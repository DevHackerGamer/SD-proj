import React from 'react';
import '../styles.css';

interface TagSelectorProps {
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

const TagSelector: React.FC<TagSelectorProps> = ({ tags, selectedTags, onToggleTag }) => {
  return (
    <div className="tag-selector">
      {tags.map(tag => (
        <div 
          key={tag} 
          className={`tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
          onClick={() => onToggleTag(tag)}
        >
          {tag}
        </div>
      ))}
    </div>
  );
};

export default TagSelector;
