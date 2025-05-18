import ManageFieldsComponent from './ManageFieldsComponent';

// Add a warning logger for debugging form submissions
const warnAboutFormSubmissions = () => {
  const originalSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function() {
    console.warn('Form submission detected!', this);
    // Fix: Use call instead of apply with arguments to avoid TypeScript error
    return originalSubmit.call(this);
  };
};

// Only run in development
if (process.env.NODE_ENV === 'development') {
  warnAboutFormSubmissions();
}

export default ManageFieldsComponent;
export { type MetadataOptionsType } from './ManageFieldsComponent';
