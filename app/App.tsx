// import { BrowserRouter as Router, Route} from "react-router-dom";
// import Home from "./routes/home";
// import Login from "./routes/login";
// import AdminPage from "./routes/admin";
// import { Routes } from "react-router";
// import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
// import { useEffect } from "react";
// import { ClerkProvider } from "@clerk/clerk-react";



// export default function App() {
//   console.log("App component loaded");

//   // useEffect(() => {
//   //   function start() {
//   //     gapi.client.init({
//   //       clientID: CLIENT_ID,
//   //       scope: "",
//   //     })
//   //   };

//   //   gapi.load("client:auth2", start);
//   // })

//   return (
//     <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
//       {/* <Router>
//         <Routes>
//           <Route index element={<Home />} />
//           <Route path="/login" element={<Login />} />
//           <Route path="/admin" element={<AdminPage />} />
//           <Route path="*" element={<div>404 Not Found, Route returned</div>} />
//         </Routes>
//       </Router> */}
//       {/* <Home/> */}
//     // </ClerkProvider>
//   );

//   // return (
//   //   <>
//   //     <h1>Testing Google Login</h1>
//   //     <GoogleLogin onSuccess={(res) => console.log("Login Success", res)} onError={() => console.log("Error")} />
//   //   </>
//   // );
// }