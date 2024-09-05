export function loadChatWidget(botName, primaryColor, avatar) {
  if (typeof window === "undefined") return () => {};

  // Function to remove existing widget
  const removeExistingWidget = () => {
    const existingScripts = document.querySelectorAll(
      "script[data-widget-script]"
    );
    existingScripts.forEach((script) => script.remove());

    if (window.Bot9v2ChatbotInstance) {
      if (typeof window.Bot9v2ChatbotInstance.cleanup === "function") {
        window.Bot9v2ChatbotInstance.cleanup();
      }
      delete window.Bot9v2ChatbotInstance;
    }

    const existingWidget = document.getElementById("chatbot-widget");
    if (existingWidget) existingWidget.remove();

    // Remove toggle button code as it's not needed in iframe
    delete window.BOTDATA;
  };

  removeExistingWidget();

  window.BOTDATA = {
    chatbotName: botName,
    primaryColor: primaryColor,
    icon: avatar,
    defaultOpen: true, // Always open in iframe
  };

  const widgetScript = document.createElement("script");
  widgetScript.src = "/dist/widget.js";
  widgetScript.async = true;
  widgetScript.setAttribute("data-widget-script", "");

  const initPromise = new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (window.Bot9v2ChatbotInstance) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error("Widget initialization timed out"));
    }, 5000);
  });

  document.body.appendChild(widgetScript);

  return initPromise
    .then(() => {
      console.log("Widget initialized successfully in iframe");
      return removeExistingWidget;
    })
    .catch((error) => {
      console.error("Failed to initialize widget in iframe:", error);
      removeExistingWidget();
      return () => {};
    });
}
