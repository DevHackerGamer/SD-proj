import React from 'react';

// Ensure the component is defined using the const syntax
const TestPage = () => {
  console.log('TestPage rendering');

  return (
    <section style={{ padding: '20px', border: '2px solid green', margin: '20px' }}>
      <h1>Test Page</h1>
      <p>If you see this, the basic routing and component rendering is working.</p>
    </section>
  );
};

export default TestPage;
