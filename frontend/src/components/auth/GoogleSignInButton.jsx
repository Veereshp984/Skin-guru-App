import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({ onCredential, role }) {
  const buttonRef = useRef(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !buttonRef.current) {
      return;
    }

    function renderButton() {
      if (!window.google?.accounts?.id || !buttonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredential(response.credential, role),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: buttonRef.current.offsetWidth,
        text: "continue_with",
      });
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      renderButton();
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    script.onerror = () => setScriptFailed(true);
    document.head.appendChild(script);
  }, [clientId, onCredential, role]);

  if (!clientId) {
    return (
      <p className="rounded-lg bg-sand px-4 py-3 text-sm text-sage">
        Google login is available after setting VITE_GOOGLE_CLIENT_ID.
      </p>
    );
  }

  if (scriptFailed) {
    return <p className="text-sm text-blush">Google login could not be loaded.</p>;
  }

  return <div className="min-h-11 w-full" ref={buttonRef} />;
}
