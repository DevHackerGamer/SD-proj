// import React from 'react';
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import { BrowserRouter } from 'react-router-dom';
// import { ClerkProvider } from '@clerk/clerk-react';
// import AdminPage from '../pages/AdminPage';

// // Mock the listFiles function from FileSystemService
// jest.mock('../components/filesystem/FileSystemService', () => ({
//   listFiles: jest.fn(() => Promise.resolve([])), // Return an empty list as mock
// }));

// // Mocking useAuth and useClerk
// jest.mock('@clerk/clerk-react', () => {
//   const originalModule = jest.requireActual('@clerk/clerk-react');
//   return {
//     ...originalModule,
//     useAuth: () => ({ isSignedIn: true, sessionId: 'test-session' }),
//     useClerk: () => ({ signOut: jest.fn() }),
//     SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
//     SignedOut: () => <div>Signed out</div>,
//     SignInButton: () => <button>Sign In</button>,
//     UserButton: () => <div>User</div>,
//   };
// });

// // Suppress Dropzone warning
// jest.mock('react-dropzone', () => ({
//   useDropzone: () => ({
//     getRootProps: () => ({ onClick: jest.fn() }),
//     getInputProps: () => ({}),
//     isDragActive: false,
//   }),
// }));

// describe('AdminPage', () => {
//   it('renders upload UI by default', () => {
//     render(
//       <ClerkProvider
//         publishableKey="pk_test_bGVnaWJsZS1zZWFob3JzZS0zMy5jbGVyay5hY2NvdW50cy5kZXYk" //key from .env
//         routerPush={() => {}}
//         routerReplace={() => {}}
//       >
//         <BrowserRouter>
//           <AdminPage />
//         </BrowserRouter>
//       </ClerkProvider>
//     );

//     expect(screen.getByTestId("upload-files-H")).toBeInTheDocument();
//     expect(screen.getByTestId("upload-files-P")).toBeInTheDocument();
//   });

//   it('switches tabs when buttons are clicked', async () => {
//     render(
//       <ClerkProvider
//         publishableKey="pk_test_bGVnaWJsZS1zZWFob3JzZS0zMy5jbGVyay5hY2NvdW50cy5kZXYk" // key from .env
//         routerPush={() => {}}
//         routerReplace={() => {}}
//       >
//         <BrowserRouter>
//           <AdminPage />
//         </BrowserRouter>
//       </ClerkProvider>
//     );

//     // File Manager Tab
//     fireEvent.click(screen.getByText('File Manager'));
//     await waitFor(() => {
//       expect(screen.getByTestId("try")).toBeInTheDocument();
//     });
//     //button test
//     fireEvent.click(screen.getByTestId('fileManager-bttn'));
//     // Upload Tab
//     fireEvent.click(screen.getByText('Quick Upload'));
//     await waitFor(() => screen.getByTestId("upload-files-H"));  // H2 header exists
//     expect(screen.getByTestId("upload-files-H")).toBeInTheDocument();
//   });

//   it('displays error message on upload attempt with no file', async () => {
//     render(
//       <ClerkProvider
//         publishableKey="pk_test_bGVnaWJsZS1zZWFob3JzZS0zMy5jbGVyay5hY2NvdW50cy5kZXYk" // Add the publishableKey prop
//         routerPush={() => {}}
//         routerReplace={() => {}}
//       >
//         <BrowserRouter>
//           <AdminPage />
//         </BrowserRouter>
//       </ClerkProvider>
//     );

//     fireEvent.click(screen.getByTestId("quick-upload-bttn"));
//     await waitFor(() => {
//       expect(screen.getByTestId("upload-files-P")).toBeInTheDocument();
//     });
//   });
// });