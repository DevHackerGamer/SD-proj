import React from 'react';

interface SearchExamplesProps {
  onExampleClick: (example: string) => void;
}

const SearchExamples: React.FC<SearchExamplesProps> = ({ onExampleClick }) => {
  const examples = [
    "Show PDF files with 'land reform' from 2020",
    "Find documents about constitutional development",
    "Search for human rights documents",
    "Show bills from Parliament",
    "Find court judgments about land reform",
    "Show TRC documents with testimonies"
  ];
  
  return (
    <div className="text-xs text-gray-400 mt-1">
      <span className="mr-1">Examples:</span>
      {examples.map((example, index) => (
        <React.Fragment key={index}>
          <button 
            className="text-blue-400 hover:underline focus:outline-none" 
            onClick={() => onExampleClick(example)}
          >
            {example}
          </button>
          {index < examples.length - 1 && <span className="mx-1">•</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SearchExamples;
