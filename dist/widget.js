(() => {
  class Bot9v2Chatbot {
    constructor(chatbotName, primaryColor, icon, defaultOpen) {
      // this.SERVER_URL = "http://10.0.5.157:5003";
      this.SERVER_URL = "https://api.v2.bot9.ai";

      this.isMobile = window.innerWidth < 767;
      this.isConfigPage = this.checkIfConfigPage();
      this.fontSize = "14px";
      this.fontFamily = "Arial, sans-serif";
      this.position = "bottom-right";
      this.defaultOpen = defaultOpen || false;
      this.chatbotName = chatbotName || "chatbot";
      this.primaryColor = primaryColor || "#2563eb";
      this.icon = icon || "";
      this.isOpen = false;
      this.isMobile = window.innerWidth < 767;
      this.showWidget =
        window.location.pathname.includes(`chat/channels`) ||
        window.location.pathname.includes(`/chat/test`);

      this.chatbotId = localStorage.getItem("chatbotId") || null;
      this.endUserId = localStorage.getItem("endUserId") || null;
      this.accessToken = localStorage.getItem("accessToken");
      this.conversationId = null;
      this.conversations = [];
      this.currentConversationStatus = "";
      this.currentBotMessage = null;
      this.baseZIndex = 100000;
      this.eventSource = null;
      this.initialize();
    }

    setUserConfig() {
      fetch(`${this.SERVER_URL}/api/chat/${this.chatbotId}/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: null,
          endUserId: localStorage.getItem("endUserId") || null,
          conversationId: localStorage.getItem("conversationId") || null,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Server error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data?.endUserId) {
            localStorage.setItem("endUserId", data.endUserId);
            this.endUserId = data.endUserId;
          }
          if (data?.conversationId) {
            localStorage.setItem("conversationId", data.conversationId);
            this.conversationId = data.conversationId;
          }
          this.initEventSource();
        })
        .catch((error) => {
          console.error("Error setting user config:", error);
        });
    }

    initEventSource() {
      this.closeEventSource();
      this.eventSource = new EventSource(
        `${this.SERVER_URL}/api/chat/sse/${this.chatbotId}/${this.conversationId}`
      );

      this.eventSource.addEventListener("message_v1", (event) => {
        console.log("Message v1 event:", event);
        const data = JSON.parse(event.data);

        if (data.type === "humanagent") {
          this.streamBotMessage(data.content, data.type);
          this.completeBotMessage();
        }

        if (data.type === "bot") {
          if (data.isPartial) {
            this.streamBotMessage(data.content, data.type);
          } else {
            this.completeBotMessage();
          }
        }
      });

      this.eventSource.addEventListener("conversationTransfer", (event) => {
        const data = JSON.parse(event.data);

        this.addMessage(
          "transfer",
          `conversation was transferred to ${
            data.destination === "needs_review" ? "agent" : "bot"
          }`
        );

        if (data.destination === "needs_review") {
          this.currentConversationStatus = "needs_review";
        } else if (data.destination === "active") {
          this.currentConversationStatus = "active";
        }
      });

      this.eventSource.onerror = (error) => {
        console.error("EventSource failed:", error);
        this.closeEventSource();
      };
    }

    initialize() {
      const chatbotWidget = this.createChatbotWidget();
      this.toggleButton = this.createToggleButton();

      document.body.appendChild(chatbotWidget);
      document.body.appendChild(this.toggleButton);

      this.widget = chatbotWidget;
      this.widget.style.translate = "50% 50%";
      this.conversationList = document.getElementById("conversation-list");
      this.messages = document.getElementById("chat-messages");
      this.userInput = document.getElementById("user-input");
      this.sendButton = document.getElementById("send-button");
      this.chatIcon = this.toggleButton.querySelector("svg:nth-child(1)");
      this.closeIcon = this.toggleButton.querySelector("svg:nth-child(2)");
      this.backButton = document.getElementById("back-button");
      this.inputArea = document.getElementById("input-area");

      this.initEventListeners();
      this.updateWidgetLayout();

      if (this.showWidget) {
        this.widget.style.display = "flex";
      } else {
        this.widget.style.display = "none";
      }

      window.addEventListener("resize", this.handleResize.bind(this));
      window.addEventListener("load", () => this.onUrlChange());

      this.checkUrlChange();

      // If defaultOpen is true, toggle the widget open
      if (this.defaultOpen && !this.isMobile) {
        setTimeout(() => {
          this.toggleWidget();
        }, 750);
      }
    }

    initEventListeners() {
      if (this.toggleButton) {
        this.toggleButton.addEventListener("click", () => this.toggleWidget());
      }
      if (this.sendButton) {
        this.sendButton.addEventListener("click", () => this.sendMessage());
      }
      if (this.userInput) {
        this.userInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") this.sendMessage();
        });
      }
      if (this.backButton) {
        this.backButton.addEventListener("click", () => {
          localStorage.removeItem("conversationId");
          this.showConversationList();
        });
      }
    }

    handleResize() {
      const newIsMobile = window.innerWidth < 767;
      if (newIsMobile !== this.isMobile) {
        this.isMobile = newIsMobile;
        this.updateWidgetLayout();
      }
    }

    checkIfConfigPage() {
      return (
        window.location.pathname.includes("/chat/channels/customize") ||
        window.location.pathname.includes("/chat/channels/integrate")
      );
    }

    updateWidgetLayout() {
      if (this.isMobile) {
        this.widget.style.width = "100%";
        this.widget.style.height = "100%";
        this.widget.style.bottom = "0";
        this.widget.style.right = "0";
        this.widget.style.margin = "0";
        this.widget.style.borderRadius = "0";
        this.addCloseButton();

        const header = this.widget.querySelector("div:first-child");
        if (header) {
          header.style.borderTopLeftRadius = "0";
          header.style.borderTopRightRadius = "0";
          header.style.items = "center";
        }
      } else {
        this.widget.style.width = this.isConfigPage ? "30%" : "40%";
        this.widget.style.height = "70%";
        // Don't set height here, let it be controlled by createChatbotWidget
        this.widget.style.bottom = "90px";
        this.widget.style.right = "10px";
        this.widget.style.margin = "0 20px 0 0";
        this.widget.style.borderRadius = "8px";

        const header = this.widget.querySelector("div:first-child");
        if (header) {
          header.style.borderTopLeftRadius = "8px";
          header.style.borderTopRightRadius = "8px";
        }

        this.removeCloseButton();
      }
    }

    addCloseButton() {
      const header = this.widget.querySelector("div");
      if (!document.getElementById("mobile-close-button")) {
        const closeButton = document.createElement("button");
        closeButton.id = "mobile-close-button";
        closeButton.innerHTML = "&#x2715;";
        closeButton.style.position = "absolute";
        closeButton.style.right = "10px";
        closeButton.style.top = "15px";
        closeButton.style.background = "none";
        closeButton.style.border = "none";
        closeButton.style.color = "white";
        closeButton.style.fontSize = "20px";
        closeButton.style.cursor = "pointer";
        closeButton.addEventListener("click", () => this.toggleWidget());
        header.appendChild(closeButton);
      }
    }

    removeCloseButton() {
      const closeButton = document.getElementById("mobile-close-button");
      if (closeButton) {
        closeButton.remove();
      }
    }

    checkUrlChange() {
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          this.onUrlChange();
        }
      }).observe(document, { subtree: true, childList: true });
    }

    onUrlChange() {
      const isChannelsPage =
        window.location.href.includes("/chat/channels/integrate") ||
        window.location.href.includes("/chat/channels/customize") ||
        window.location.href.includes("/test");
      this.showWidget = isChannelsPage;
      this.widget.style.display = isChannelsPage ? "flex" : "none";
      this.toggleButton.style.display = isChannelsPage ? "block" : "none";

      // Update isConfigPage
      this.isConfigPage = this.checkIfConfigPage();

      // Update widget width based on current URL
      if (this.isMobile) {
        this.widget.style.width = "100%";
      } else if (this.isConfigPage) {
        this.widget.style.width = "20%";
        this.widget.style.height = "60%";
      } else {
        this.widget.style.width = "30%";
        this.widget.style.height = "80%";
      }

      const isCustomizeOrIntegrate = this.isConfigPage;
      if (isCustomizeOrIntegrate && !this.isOpen) {
        this.toggleWidget();
      } else if (!isCustomizeOrIntegrate && this.isOpen) {
        this.toggleWidget();
      }
    }

    handleConfig(data) {
      if (data.conversationId) {
        this.conversationId = data.conversationId;
        localStorage.setItem("conversationId", this.conversationId);
      }
    }

    createChatbotWidget() {
      const chatbotWidget = document.createElement("div");
      chatbotWidget.id = "chatbot-widget";

      let widgetWidth = this.isMobile
        ? "100%"
        : this.isConfigPage
        ? "20%"
        : "40%";
      let widgetHeight = this.isMobile ? "100%" : "80%";

      chatbotWidget.style.cssText = `
        z-index: ${this.baseZIndex};
        position: fixed;
        width: ${widgetWidth} !important;
        height: ${widgetHeight} !important;
        background-color: white;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        transition: all 0.3s ease-in-out;
        transform: scale(0);
        opacity: 0;
      `;

      if (this.isMobile) {
        chatbotWidget.style.bottom = "0";
        chatbotWidget.style.right = "0";
        chatbotWidget.style.margin = "0";
        chatbotWidget.style.borderRadius = "0";
      } else {
        chatbotWidget.style.bottom = "90px";
        chatbotWidget.style.right = "10px";
        chatbotWidget.style.margin = "0 20px 0 0";
        chatbotWidget.style.borderRadius = "8px";
      }

      const header = this.createHeader();
      const conversationList = this.createConversationList();
      const chatMessages = this.createChatMessages();
      const inputArea = this.createInputArea();

      chatbotWidget.appendChild(header);
      chatbotWidget.appendChild(conversationList);
      chatbotWidget.appendChild(chatMessages);
      chatbotWidget.appendChild(inputArea);

      return chatbotWidget;
    }

    createHeader() {
      const header = document.createElement("div");
      header.style.cssText = `
        background-color: ${this.primaryColor};
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        position: relative;
        height: 60px;
        box-sizing: border-box;
      `;

      if (this.isMobile) {
        header.style.borderTopLeftRadius = "";
        header.style.borderTopRightRadius = "";
      } else {
        header.style.borderTopLeftRadius = "8px";
        header.style.borderTopRightRadius = "8px";
      }

      const backButton = this.createBackButton();
      backButton.style.marginRight = "16px";
      header.appendChild(backButton);

      const titleContainer = document.createElement("div");
      titleContainer.style.cssText = `
        display: flex;
        align-items: center;
        flex-grow: 1;
      `;

      const iconContainer = document.createElement("div");
      iconContainer.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-right: 12px;
        flex-shrink: 0;
      `;

      const iconImg = document.createElement("img");
      iconImg.src = this.icon;
      iconImg.alt = "Chatbot Icon";
      iconImg.style.cssText = `
        width: 20px;
        height: 20px;
        object-fit: cover;
      `;

      iconContainer.appendChild(iconImg);
      titleContainer.appendChild(iconContainer);

      const title = document.createElement("h2");
      title.textContent = this.chatbotName;
      title.style.cssText = `
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;

      titleContainer.appendChild(title);
      header.appendChild(titleContainer);

      if (this.isMobile) {
        const closeButton = this.createCloseButton();
        closeButton.style.marginLeft = "16px";
        header.appendChild(closeButton);
      }

      return header;
    }

    createBackButton() {
      const backButton = document.createElement("button");
      backButton.id = "back-button";
      backButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: none;
        padding: 0;
        line-height: 0;
      `;
      backButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      `;
      return backButton;
    }

    createCloseButton() {
      const closeButton = document.createElement("button");
      closeButton.id = "mobile-close-button";
      closeButton.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 0;
      `;
      closeButton.innerHTML = "&#x2715;";
      closeButton.addEventListener("click", () => this.toggleWidget());
      return closeButton;
    }

    createConversationList() {
      const conversationList = document.createElement("div");
      conversationList.id = "conversation-list";
      conversationList.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        padding: 16px;
      `;
      return conversationList;
    }

    createChatMessages() {
      const chatMessages = document.createElement("div");
      chatMessages.id = "chat-messages";
      chatMessages.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        padding: 16px;
        display: none;
      `;
      return chatMessages;
    }

    createInputArea() {
      const inputArea = document.createElement("div");
      inputArea.id = "input-area";
      inputArea.style.cssText = `
        padding: 16px;
        border-top: 1px solid #e0e0e0;
        display: none;
      `;

      const inputWrapper = document.createElement("div");
      inputWrapper.style.cssText = `
        display: flex;
      `;

      const input = document.createElement("input");
      input.id = "user-input";
      input.type = "text";
      input.placeholder = "Type a message...";
      input.style.cssText = `
        flex-grow: 1;
        color: black;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-right: none;
        border-top-left-radius: 4px;
        border-bottom-left-radius: 4px;
        outline: none;
      `;

      const sendButton = document.createElement("button");
      sendButton.id = "send-button";
      sendButton.textContent = "Send";
      sendButton.style.cssText = `
        background-color: ${this.primaryColor};
        color: white;
        padding: 8px 16px;
        border: none;
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
        cursor: pointer;
      `;

      inputWrapper.appendChild(input);
      inputWrapper.appendChild(sendButton);
      inputArea.appendChild(inputWrapper);

      return inputArea;
    }

    createToggleButton() {
      const toggleButton = document.createElement("button");
      toggleButton.id = "toggle-chatbot";
      toggleButton.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        background-color: ${this.primaryColor};
        color: white;
        padding: 16px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease-in-out;
      `;

      const messageIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      messageIcon.setAttribute("viewBox", "0 0 24 24");
      messageIcon.setAttribute("width", "24px");
      messageIcon.setAttribute("height", "24px");
      messageIcon.innerHTML =
        '<g><rect width="24" height="24" opacity="0"></rect><path d="M19.07 4.93a10 10 0 0 0-16.28 11 1.06 1.06 0 0 1 .09.64L2 20.8a1 1 0 0 0 .27.91A1 1 0 0 0 3 22h.2l4.28-.86a1.26 1.26 0 0 1 .64.09 10 10 0 0 0 11-16.28zM8 13a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm4 0a1 1 0 1 1 1-1 1 1 0 0 1-1 1zm4 0a1 1 0 1 1 1-1 1 1 0 0 1-1 1z"></path></g>';
      messageIcon.setAttribute("fill", "currentColor");

      const closeIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      closeIcon.setAttribute("viewBox", "0 0 512 512");
      closeIcon.setAttribute("width", "24px");
      closeIcon.setAttribute("height", "24px");
      closeIcon.innerHTML =
        '<path d="M437.5 386.6L306.9 256l130.6-130.6c14.1-14.1 14.1-36.8 0-50.9-14.1-14.1-36.8-14.1-50.9 0L256 205.1 125.4 74.5c-14.1-14.1-36.8-14.1-50.9 0-14.1 14.1-14.1 36.8 0 50.9L205.1 256 74.5 386.6c-14.1 14.1-14.1 36.8 0 50.9 14.1 14.1 36.8 14.1 50.9 0L256 306.9l130.6 130.6c14.1 14.1 36.8 14.1 50.9 0 14-14.1 14-36.9 0-50.9z"></path>';
      closeIcon.setAttribute("fill", "currentColor");
      closeIcon.style.display = "none";

      toggleButton.appendChild(messageIcon);
      toggleButton.appendChild(closeIcon);

      return toggleButton;
    }

    toggleWidget() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.toggleButton.style.transform = `rotate(90deg)`;
        this.widget.style.translate = "0% 0%";
        this.widget.style.transform = "scale(1)";
        this.widget.style.opacity = "1";
        this.chatIcon.style.display = "none";
        this.closeIcon.style.display = "block";
        this.showConversationList();
      } else {
        this.toggleButton.style.transform = `rotate(0deg)`;
        this.widget.style.translate = "50% 50%";
        this.widget.style.transform = "scale(0)";
        this.widget.style.opacity = "0";
        this.chatIcon.style.display = "block";
        this.closeIcon.style.display = "none";
        this.closeEventSource();
      }
    }

    closeEventSource() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    }

    showConversationList() {
      this.closeEventSource();
      this.conversationList.style.display = "block";
      this.messages.style.display = "none";
      this.inputArea.style.display = "none";
      this.backButton.style.display = "none";
      this.fetchConversations();
    }

    fetchConversations() {
      if (!this.chatbotId) {
        console.error("chatbotId not found!");
        this.conversationList.innerHTML = `<p>Error: Chatbot ID not found.</p>`;
        return;
      }

      if (!this.endUserId) {
        console.log(
          "endUserId not found. Showing only new conversation button."
        );
        this.renderConversationList([]);
        return;
      }

      fetch(
        `${this.SERVER_URL}/api/chat/${this.chatbotId}/conversations?endUserId=${this.endUserId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          this.conversations = data;
          this.renderConversationList(this.conversations);
          console.log(this.conversations);
        })
        .catch((error) => {
          console.error("Error fetching conversations:", error);
          this.conversationList.innerHTML = `<p>Error loading conversations. Please try again later.</p>`;
          this.renderConversationList([]);
        });
    }

    renderConversationList(conversations) {
      this.conversationList.innerHTML = "";

      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.height = "100%";

      const scrollArea = document.createElement("div");
      scrollArea.style.flexGrow = "1";
      scrollArea.style.overflowY = "auto";

      if (conversations.length > 0) {
        conversations.forEach((conv, index) => {
          const convDiv = document.createElement("div");
          convDiv.style.padding = "12px 0";
          convDiv.style.cursor = "pointer";
          convDiv.style.borderBottom =
            index < this.conversations.length - 1
              ? "1px solid #e0e0e0"
              : "none";
          convDiv.style.position = "relative";
          convDiv.onclick = () => {
            this.loadConversation(conv.id);
          };

          const titleDiv = document.createElement("div");
          titleDiv.textContent = conv.subject || `Conversation ${conv.id}`;
          titleDiv.style.color = "black";
          titleDiv.style.marginBottom = "4px";
          titleDiv.style.paddingRight = "80px";

          const previewDiv = document.createElement("div");
          previewDiv.style.fontSize = "14px";
          previewDiv.style.color = "#6b7280";
          previewDiv.style.paddingRight = "80px";

          const prefix =
            conv?.Messages[0]?.chatUser === "bot"
              ? "Bot: "
              : conv?.Messages[0]?.chatUser === "humanagent"
              ? "Agent: "
              : "You: ";

          const displayText =
            prefix + conv?.Messages[0]?.chatText?.substring(0, 40) + "...";
          previewDiv.textContent = displayText;

          const timestampDiv = document.createElement("div");
          timestampDiv.style.fontSize = "12px";
          timestampDiv.style.color = "#9ca3af";
          timestampDiv.style.position = "absolute";
          timestampDiv.style.top = "12px";
          timestampDiv.style.right = "0";
          timestampDiv.textContent = this.formatListingTime(
            conv?.Messages[0]?.createdAt
          );

          convDiv.appendChild(titleDiv);
          convDiv.appendChild(previewDiv);
          convDiv.appendChild(timestampDiv);
          scrollArea.appendChild(convDiv);
        });
      } else {
        const noConversationsMsg = document.createElement("p");
        noConversationsMsg.textContent =
          "No conversations yet. Start a new one!";
        noConversationsMsg.style.textAlign = "center";
        noConversationsMsg.style.color = "#6b7280";
        scrollArea.appendChild(noConversationsMsg);
      }

      const stickyBottom = document.createElement("div");
      stickyBottom.style.position = "sticky";
      stickyBottom.style.bottom = "0";
      stickyBottom.style.backgroundColor = "white";
      stickyBottom.style.paddingTop = "8px";

      const newConvButton = document.createElement("button");
      newConvButton.id = "new-conv-button";
      newConvButton.textContent = "Start New Conversation";
      newConvButton.style.width = "100%";
      newConvButton.style.padding = "8px";
      newConvButton.style.backgroundColor = this.primaryColor;
      newConvButton.style.color = "white";
      newConvButton.style.border = "none";
      newConvButton.style.borderRadius = "4px";
      newConvButton.style.cursor = "pointer";
      newConvButton.addEventListener("click", () =>
        this.startNewConversation()
      );

      stickyBottom.appendChild(newConvButton);
      container.appendChild(scrollArea);
      container.appendChild(stickyBottom);
      this.conversationList.appendChild(container);
    }

    formatListingTime(time) {
      const now = new Date();
      const messageDate = new Date(time);

      const isToday = now.toDateString() === messageDate.toDateString();

      if (isToday) {
        const hours = messageDate.getHours();
        const minutes = messageDate.getMinutes().toString().padStart(2, "0");
        const period = hours >= 12 ? "PM" : "AM";
        const formattedHours = hours % 12 || 12;
        return `${formattedHours}:${minutes} ${period}`;
      } else {
        const timeDifference = now - messageDate;
        const daysAgo = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

        if (daysAgo < 7) {
          return `${daysAgo} day${daysAgo > 1 ? "s" : ""} ago`;
        } else if (daysAgo < 30) {
          const weeksAgo = Math.floor(daysAgo / 7);
          return `${weeksAgo} week${weeksAgo > 1 ? "s" : ""} ago`;
        } else if (daysAgo < 365) {
          const monthsAgo = Math.floor(daysAgo / 30);
          return `${monthsAgo} month${monthsAgo > 1 ? "s" : ""} ago`;
        } else {
          const yearsAgo = Math.floor(daysAgo / 365);
          return `${yearsAgo} year${yearsAgo > 1 ? "s" : ""} ago`;
        }
      }
    }

    startNewConversation() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.conversationId = null;
      this.messages.innerHTML = "";
      this.showChat();
      this.userInput.focus();
      this.setUserConfig();
    }

    showChat() {
      this.conversationList.style.display = "none";
      this.messages.style.display = "block";
      this.inputArea.style.display = "block";
      this.backButton.style.display = "block";
      this.userInput.focus();
    }

    loadConversation(id) {
      this.conversationId = id;
      localStorage.setItem("conversationId", id);
      fetch(`${this.SERVER_URL}/api/chat/${this.chatbotId}/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })
        .then((response) => response.json())
        .then((conversation) => {
          this.messages.innerHTML = "";
          if (conversation.Messages && conversation.Messages.length > 0) {
            this.currentConversationStatus = conversation.status;
            conversation?.Messages?.forEach((msg) =>
              this.addMessage(
                msg.chatUser,
                msg.chatText,
                this.formatChatTime(msg.createdAt)
              )
            );
          }
          this.showChat();
          this.initEventSource();
        })
        .catch((error) => console.error("Error loading conversation:", error));
    }

    sendMessage() {
      const message = this.userInput.value.trim();
      if (!message || !this.chatbotId) return;

      const date = new Date();
      this.addMessage("user", message, this.formatChatTime(date.getTime()));
      this.userInput.value = "";

      if (this.currentConversationStatus === "needs_review") {
        this.sendMessageAssigned(message);
      } else {
        this.sendMessageBot(message);
      }
    }

    sendMessageBot(content) {
      fetch(`${this.SERVER_URL}/api/chat/${this.chatbotId}/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          endUserId: localStorage.getItem("endUserId"),
          conversationId: this.conversationId,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        })
        .catch((error) => {
          console.error("Error sending message (assigned):", error);
          this.addMessage(
            "bot",
            "An error occurred while sending your message. Please try again.",
            this.formatChatTime(new Date().getTime())
          );
        });
    }

    sendMessageAssigned(content) {
      fetch(
        `${this.SERVER_URL}/api/chat/${this.chatbotId}/${this.conversationId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatUser: "user",
            message: content,
          }),
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Message sent successfully:", data);
        })
        .catch((error) => {
          console.error("Error sending message (assigned):", error);
          this.addMessage(
            "bot",
            "An error occurred while sending your message. Please try again.",
            this.formatChatTime(new Date().getTime())
          );
        });
    }

    streamBotMessage(content, sender) {
      if (!this.currentBotMessage) {
        // Create a new message element for the bot or agent
        const messageElement = document.createElement("div");
        messageElement.style.marginBottom = "12px";
        messageElement.style.display = "flex";
        messageElement.style.justifyContent = "flex-start";

        const messageContent = document.createElement("div");
        messageContent.style.maxWidth = "70%";
        messageContent.style.padding = "8px 12px";
        messageContent.style.borderRadius = "12px";
        messageContent.style.fontSize = "14px";
        messageContent.style.lineHeight = "1.4";
        messageContent.style.display = "flex";
        messageContent.style.flexDirection = "column";
        messageContent.style.wordWrap = "break-word";
        messageContent.style.overflowWrap = "break-word";
        messageContent.style.backgroundColor = "#f0f0f0";
        messageContent.style.color = "black";
        messageContent.style.borderBottomLeftRadius = "4px";

        const textContent = document.createElement("div");
        textContent.style.flexGrow = "1";

        const senderSpan = document.createElement("span");
        senderSpan.style.fontWeight = "bold";
        senderSpan.textContent = sender === "humanagent" ? "Agent: " : "Bot: ";

        textContent.appendChild(senderSpan);
        this.currentBotMessage = document.createElement("span");
        textContent.appendChild(this.currentBotMessage);

        const messageTimestamp = document.createElement("div");
        messageTimestamp.style.fontSize = "9px";
        messageTimestamp.style.color = "rgba(0,0,0,0.5)";
        messageTimestamp.style.alignSelf = "flex-end";
        messageTimestamp.style.marginTop = "4px";
        messageTimestamp.textContent = this.formatChatTime(
          new Date().getTime()
        );

        messageContent.appendChild(textContent);
        messageContent.appendChild(messageTimestamp);
        messageElement.appendChild(messageContent);
        this.messages.appendChild(messageElement);
      }

      this.currentBotMessage.textContent += content;
      this.messages.scrollTop = this.messages.scrollHeight;
    }

    completeBotMessage() {
      this.currentBotMessage = null;
    }

    formatChatTime(time) {
      const messageDate = new Date(time);

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const dayOfWeek = days[messageDate.getDay()];
      const month = months[messageDate.getMonth()];
      const date = messageDate.getDate();

      let hours = messageDate.getHours();
      const minutes = messageDate.getMinutes().toString().padStart(2, "0");
      const period = hours >= 12 ? "PM" : "AM";

      hours = hours % 12 || 12;

      return `${dayOfWeek}, ${month} ${date}, ${hours}:${minutes} ${period}`;
    }

    addMessage(sender, message, timestamp) {
      if (sender === "tool" || message === "") {
        return;
      }

      const messageElement = document.createElement("div");
      messageElement.style.marginBottom = "12px";
      messageElement.style.display = "flex";
      messageElement.style.justifyContent =
        sender === "user"
          ? "flex-end"
          : sender === "transfer"
          ? "center"
          : "flex-start";

      const messageContent = document.createElement("div");
      messageContent.style.maxWidth = "70%";
      messageContent.style.padding = "8px 12px";
      messageContent.style.borderRadius = "12px";
      messageContent.style.fontSize = "14px";
      messageContent.style.lineHeight = "1.4";
      messageContent.style.display = "flex";
      messageContent.style.flexDirection = "column";
      messageContent.style.wordWrap = "break-word";
      messageContent.style.overflowWrap = "break-word";

      if (sender === "transfer") {
        messageContent.style.backgroundColor = `${this.primaryColor}33`; // 33 is 20% opacity in hex
        messageContent.style.color = this.primaryColor;
        messageContent.style.border = "none";
        messageContent.style.borderRadius = "8px";
        messageContent.style.padding = "4px 8px";
        messageContent.style.fontSize = "11px";
        messageContent.style.fontWeight = "normal";
        messageContent.style.textTransform = "none";
        messageContent.style.letterSpacing = "normal";
        messageContent.style.boxShadow = "none";
      } else if (sender === "user") {
        messageContent.style.backgroundColor = this.primaryColor;
        messageContent.style.color = "white";
        messageContent.style.borderBottomRightRadius = "4px";
      } else {
        messageContent.style.backgroundColor = "#f0f0f0";
        messageContent.style.color = "black";
        messageContent.style.borderBottomLeftRadius = "4px";
      }

      const textContent = document.createElement("div");
      textContent.style.flexGrow = "1";

      const senderSpan = document.createElement("span");
      senderSpan.style.fontWeight = "bold";
      senderSpan.textContent = `${
        sender === "user"
          ? "You"
          : sender === "humanagent"
          ? "Agent"
          : sender === "bot"
          ? "Bot"
          : ""
      }: `;

      if (sender !== "transfer") {
        textContent.appendChild(senderSpan);
      }
      textContent.appendChild(document.createTextNode(message));

      const messageTimestamp = document.createElement("div");
      messageTimestamp.style.fontSize = "9px";
      messageTimestamp.style.color =
        sender === "user" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";
      messageTimestamp.style.alignSelf = "flex-end";
      messageTimestamp.style.marginTop = "4px";
      messageTimestamp.textContent = timestamp;

      messageContent.appendChild(textContent);
      if (sender !== "transfer") {
        messageContent.appendChild(messageTimestamp);
      }
      messageElement.appendChild(messageContent);
      this.messages.appendChild(messageElement);
      this.messages.scrollTop = this.messages.scrollHeight;
    }
  }

  window.Bot9v2ChatbotInstance = new Bot9v2Chatbot(
    BOTDATA?.chatbotName || "chatbot",
    BOTDATA?.primaryColor || "#000000",
    BOTDATA?.icon || "",
    BOTDATA?.defaultOpen || false
  );
})();
