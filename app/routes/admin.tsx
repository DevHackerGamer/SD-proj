import { SignedOut, SignInButton, SignedIn, UserButton, useUser } from "@clerk/clerk-react";
import path, { extname } from "path";
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function AdminPage() {
  //api call for upload

    //Ading file start
    
    //adding file configuration
    const [file, setFile] = useState<File | null>(null);
    const[status,setStatus] = useState("");
    const{user} = useUser();

    //react-dropzone
    const onDrop = (accpetedFiles:File[])=>{
      setFile(accpetedFiles[0]);
      setStatus("");
    };
    const{getRootProps,getInputProps,isDragActive} = useDropzone({
      onDrop,
      multiple:false,
    });



    //handleFileChange for the next file
    const handleFileChange = (given: React.ChangeEvent<HTMLInputElement>)=>{
      const selectedFile = given.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setStatus(selectedFile.name);
      }
    };

    //Upload the file
    const handleUpload = async()=>{
      if(!file){
        setStatus("Please select a file to upload!");
        window.alert("Please select a file to upload!")
        return;
      }
      const formData = new FormData();
      formData.append("file",file);
      setStatus("Uploading, please wait...");
      try{
        const response = await fetch("http://localhost:5000/api/upload", {
          method: "POST",
          body: formData,
        });
    
        const data = await response.json();
    
        if (response.ok) {
          const ext = data.fileName.split('.').pop()?.toUpperCase() || "";
          window.alert(`${ext} file '${data.fileName}' uploaded and processed successfully.`);
          setStatus(`Upload complete: ${data.fileName}`);
        } else {
          setStatus(`Upload failed: ${data.error}`);
        }
      } catch (error) {
        setStatus(`Upload error: ${error}`);
      }
    }
    // Adding file end

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <header style={{ position: "absolute", top: "1rem", right: "1rem", fontSize: "1.25rem" }}>
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      <h1>Welcome, Admin!</h1>
      <p>This is the admin dashboard.</p>

      <section {...getRootProps()}     style={{border: '3px dashed #4CAF50',borderRadius: '8px',padding: '20px',marginTop: '20px',cursor: "pointer",backgroundColor: isDragActive ? '#f0f8ff' : '#fff',transition: 'background-color 0.3s ease',boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'}}>
          <input {...getInputProps()}/>
          {file ?(
            <p style={{textAlign: 'center',padding: '20px',border: '2px dashed #007BFF',borderRadius: '10px',backgroundColor: '#e7f7e7',color: '#333',fontSize: '16px',cursor: 'pointer',transition: 'background-color 0.3s ease'}}>
               <strong><b>{file.name}</b></strong> selected. Click to change or drag another file on the dropzone.
            </p>):
          isDragActive?
          (<p style={{textAlign: 'center',padding: '20px',border: '2px dashed #007BFF', borderRadius: '10px', backgroundColor: '#f9f9f9', color: '#333', fontSize: '16px', cursor: 'pointer', transition: 'background-color 0.3s ease'}}>Drag and drop a file here...</p>):
          (<p style={{textAlign: 'center',padding: '20px',border: '2px dashed #007BFF',borderRadius: '10px',backgroundColor: '#f9f9f9',color: '#333',fontSize: '16px',cursor: 'pointer',transition: 'background-color 0.3s ease'}}>Click here to upload files, OR drag files</p>)
          }
      </section>
      {/* <label htmlFor="upload" style={{fontSize:'16px',fontWeight:'bold',margin:'8px',display:'inline-block',textShadow:'0 0 5px blue, 0 0 10px blue, 0 0 20px blue'}}>Upload file below</label><br/> */}
      {/* <input onChange={handleFileChange} type="file" id="upload" name="upload" style={{fontSize:'16px',fontWeight:'bold',margin:'8px',display:'inline-block',textShadow:'0 0 5px blue, 0 0 10px blue, 0 0 20px blue'}}/><br/> */}
      <button onClick={handleUpload} style={{ cursor:'pointer',fontSize:'16px',fontWeight:'bold',margin:'8px',display:'inline-block',textShadow:'0 0 5px green, 0 0 10px green, 0 0 20px green'}}>Upload</button>
      {status && 
        (
          <p style={{ marginTop: "10px", color: status.startsWith("✅") ? "green" : "red" }}>
            {status}
          </p>
        )
      }
    </main>
  );
}