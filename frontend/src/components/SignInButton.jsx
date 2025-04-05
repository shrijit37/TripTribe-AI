import { useEffect, useRef } from "react";

const SigninButton = () => {
  const wrapperRef = useRef(null);
  const CLIENT_ID = "13413836923632591292";

  useEffect(() => {
    // Load the script
    const script = document.createElement("script");
    script.src = "https://www.phone.email/verify_email_v1.js";
    script.async = true;
    
    script.onload = () => {
      // Let their script initialize, but hide their button
      if (wrapperRef.current) {
        const originalButton = wrapperRef.current.querySelector('button');
        if (originalButton && originalButton !== wrapperRef.current.lastChild) {
          originalButton.style.display = 'none';
        }
      }
    };
    
    document.body.appendChild(script);

    // Define callback
    window.phoneEmailReceiver = (userObj) => {
      const userJsonUrl = userObj.user_json_url;
      console.log('Verification successful:', userJsonUrl);
      // Handle the verification result here
      fetch(userJsonUrl)
        .then(response => response.json())
        .then(data => {
          console.log('User data:', data);
          // Process the user data as needed
        });
    };

    return () => {
      document.body.removeChild(script);
      delete window.phoneEmailReceiver;
    };
  }, []);

  return (
    <div ref={wrapperRef} className="pe_verify_email" data-client-id={CLIENT_ID}>
      <button 
        id="btn_email_login"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Sign in with Email
      </button>
    </div>
  );
};

export default SigninButton;