let selectedConversationId = null;

const conversationList =
    document.getElementById("conversationList");

const adminChatMessages =
    document.getElementById("adminChatMessages");

const adminReplyInput =
    document.getElementById("adminReplyInput");

const sendReplyBtn =
    document.getElementById("sendReplyBtn");

const unreadBadge =
    document.getElementById("unreadBadge");

const chatHeader =
    document.getElementById("chatHeader");

async function loadConversations() {

    const { data, error } = await supabaseClient
        .from("chat_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    renderConversationList(data || []);
}

function renderConversationList(conversations) {

    if (!conversations.length) {

        conversationList.innerHTML = `
      <div style="padding:20px;">
        No conversations yet.
      </div>
    `;

        unreadBadge.textContent = "0";

        return;
    }

    unreadBadge.textContent =
        conversations.length;

    conversationList.innerHTML =
        conversations.map((conversation, index) => {

            const name =
                conversation.customer_name ||
                conversation.guest_id ||
                "Guest Customer";

            return `
        <div
          class="conversation-item ${selectedConversationId === conversation.id ? "active" : ""}"
          onclick="openConversation('${conversation.id}')"
        >

          <div class="conversation-top">

            <div class="conversation-name">
              ${name}
            </div>

            <div class="conversation-time">
              ${formatTime(conversation.updated_at)}
            </div>

          </div>

          <div class="conversation-preview">
            ${conversation.last_message || "No messages yet"}
          </div>

        </div>
      `;
        }).join("");
}

async function openConversation(conversationId) {

    selectedConversationId = conversationId;

    const { data, error } = await supabaseClient
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    renderMessages(data || []);

    await supabaseClient
        .from("chat_messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "customer");

    document
        .querySelectorAll(".conversation-item")
        .forEach(item => item.classList.remove("active"));

    const activeItem =
        [...document.querySelectorAll(".conversation-item")]
            .find(item =>
                item.getAttribute("onclick")
                    ?.includes(conversationId)
            );

    activeItem?.classList.add("active");

    chatHeader.textContent =
        "Customer Support Chat";

    if (window.innerWidth <= 768) {
        document
            .querySelector(".chat-main")
            ?.classList.add("show");
    }
}

function renderMessages(messages) {

    if (!messages.length) {

        adminChatMessages.innerHTML = `
      <div style="padding:20px;">
        No messages yet.
      </div>
    `;

        return;
    }

    adminChatMessages.innerHTML =
        messages.map(msg => {

            let content = "";

            if (msg.image_url) {

                content = `
                <img
                    src="${msg.image_url}"
                    class="chat-image">
            `;

            }
            else if (msg.video_url) {

                content = `
                <video controls class="chat-video">
                    <source src="${msg.video_url}">
                </video>
            `;

            }
            else {

                content = escapeHtml(msg.message || "");

            }

            return `
            <div class="chat-message ${msg.sender_type}">
                ${content}
            </div>
        `;

        }).join("");

    adminChatMessages.scrollTop =
        adminChatMessages.scrollHeight;
}

async function sendAdminReply() {

    if (!selectedConversationId) {
        alert("Select conversation first.");
        return;
    }

    const message =
        adminReplyInput.value.trim();

    if (!message) return;

    adminReplyInput.value = "";

    appendMessage({
        sender_type: "admin",
        message
    });


    const { error } = await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: selectedConversationId,
            sender_type: "admin",
            message,
            is_read: false
        });

    if (error) {
        console.error(error);
        return;
    }

    await supabaseClient
        .from("chat_conversations")
        .update({
            updated_at: new Date().toISOString(),
            last_message: message
        })
        .eq("id", selectedConversationId);
}

sendReplyBtn?.addEventListener(
    "click",
    sendAdminReply
);

adminReplyInput?.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {
            event.preventDefault();
            sendAdminReply();
        }

    }
);

function subscribeRealtime() {

    supabaseClient
        .channel("admin-chat-realtime")

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_messages"
            },
            async (payload) => {

                const msg = payload.new;

                await loadConversations();

                if (
                    selectedConversationId &&
                    msg.conversation_id === selectedConversationId
                ) {

                    if (msg.sender_type !== "admin") {
                        appendMessage(msg);
                    }

                }

            }
        )

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "chat_conversations"
            },
            async () => {

                await loadConversations();

            }
        )

        .subscribe();
}

function appendMessage(msg) {

    const div =
        document.createElement("div");

    div.className =
        `chat-message ${msg.sender_type}`;

    div.textContent =
        msg.message;

    adminChatMessages.appendChild(div);

    adminChatMessages.scrollTop =
        adminChatMessages.scrollHeight;
}

function formatTime(date) {

    if (!date) return "";

    return new Date(date)
        .toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
}

function escapeHtml(text = "") {

    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

loadConversations();

subscribeRealtime();

setInterval(loadConversations, 5000);

let adminTypingTimer = null;

const customerTypingText =
    document.getElementById("customerTypingText");

async function setAdminTypingStatus(isTyping) {

    if (!selectedConversationId) return;

    await supabaseClient
        .from("chat_typing_status")
        .upsert({
            conversation_id: selectedConversationId,
            sender_type: "admin",
            is_typing: isTyping,
            updated_at: new Date().toISOString()
        });
}

function showCustomerTyping(show) {

    if (!customerTypingText) return;

    customerTypingText.classList.toggle(
        "show",
        show
    );
}

function subscribeTypingRealtime() {

    supabaseClient
        .channel("admin-typing-status")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "chat_typing_status"
            },
            (payload) => {

                const row = payload.new;

                if (
                    !selectedConversationId ||
                    row.conversation_id !== selectedConversationId
                ) {
                    return;
                }

                if (row.sender_type === "customer") {
                    showCustomerTyping(row.is_typing);
                }

            }
        )

        .subscribe();
}

adminReplyInput?.addEventListener(
    "input",
    () => {

        setAdminTypingStatus(true);

        clearTimeout(adminTypingTimer);

        adminTypingTimer = setTimeout(() => {
            setAdminTypingStatus(false);
        }, 1200);

    }
);

window.addEventListener("blur", () => {
    setAdminTypingStatus(false);
});

document.addEventListener("visibilitychange", () => {

    if (document.hidden) {
        setAdminTypingStatus(false);
    }

});

subscribeTypingRealtime();

document.addEventListener("visibilitychange", () => {

    if (!document.hidden) {
        loadConversations();
    }

});

function toggleAdminEmojiPanel() {
    const panel = document.getElementById("adminEmojiPanel");
    if (!panel) return;

    panel.style.display =
        panel.style.display === "block" ? "none" : "block";
}

function addAdminEmoji(emoji) {
    const input = document.getElementById("adminReplyInput");
    if (!input) return;

    input.value += emoji;
    input.focus();
}