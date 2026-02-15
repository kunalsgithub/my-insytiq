const { getFunctions, connectFunctionsEmulator, httpsCallable } = require("firebase/functions");
const { initializeApp } = require("firebase/app");

// Replace with your Firebase project's config
const firebaseConfig = {
  apiKey: "AIzaSyAigHZtOY0Aa5i1bOzCHLgSTYjhcL7L-Mc",
  authDomain: "social-trends-29ac2.firebaseapp.com",
  projectId: "social-trends-29ac2",
  appId: "1:829824264022:web:569589e8538e04dc3a58f7",
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Connect to emulator
//connectFunctionsEmulator(functions, "127.0.0.1", 5001);

// Call the function
const test = async () => {
  const fetchData = httpsCallable(functions, "fetchAndStoreInstagramData");

  try {
    const result = await fetchData({
      userId: "testUser123",
      username: "example_instagram_username" // Use any real or test username
    });

    console.log("Result from function:", result.data);
  } catch (err) {
    console.error("Error calling function:", err);
  }
};

test();
