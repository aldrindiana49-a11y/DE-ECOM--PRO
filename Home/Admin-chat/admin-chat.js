
async function checkAdminAccess() {
    const { data: { session } } =
        await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "./dashboard-index.html";
        return false;
    }

    const { data: adminData, error } =
        await supabaseClient
            .from("admin_users")
            .select("role")
            .eq("id", session.user.id)
            .eq("role", "admin")
            .single();

    if (error || !adminData) {
        await supabaseClient.auth.signOut();
        window.location.href = "./dashboard-index.html";
        return false;
    }

    return true;
}

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
        .select(`
            *,
            chat_messages (
                id,
                sender_type,
                is_read
            )
        `)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const sortedConversations = (data || []).sort((a, b) => {

        const unreadA = (a.chat_messages || [])
            .filter(msg =>
                msg.sender_type === "customer" &&
                msg.is_read === false
            ).length;

        const unreadB = (b.chat_messages || [])
            .filter(msg =>
                msg.sender_type === "customer" &&
                msg.is_read === false
            ).length;

        // may unread → priority sa taas
        if (unreadA > 0 && unreadB === 0) return -1;
        if (unreadA === 0 && unreadB > 0) return 1;

        // parehong unread/read → newest sa taas
        return new Date(b.updated_at) - new Date(a.updated_at);
    });

    renderConversationList(sortedConversations);
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

    const totalUnread = conversations.reduce((total, conversation) => {

        const unreadCount = (conversation.chat_messages || [])
            .filter(msg =>
                msg.sender_type === "customer" &&
                msg.is_read === false
            ).length;

        return total + unreadCount;

    }, 0);

    unreadBadge.textContent = totalUnread;

    conversationList.innerHTML =
        conversations.map((conversation, index) => {

            const name =
                conversation.customer_name ||
                conversation.guest_id ||
                "Guest Customer";

            const unreadCount =
                (conversation.chat_messages || [])
                    .filter(msg =>
                        msg.sender_type === "customer" &&
                        msg.is_read === false
                    ).length;

            return `
        <div
          class="conversation-item ${selectedConversationId === conversation.id ? "active" : ""}"
          onclick="openConversation('${conversation.id}')"
        >

          <div class="conversation-top">

            <div class="conversation-name">
  ${name}

  ${unreadCount > 0
                    ? `<span class="conversation-unread-badge">${unreadCount}</span>`
                    : ""
                }
</div>

            <div style="display:flex; align-items:center; gap:8px;">

  <button
    class="pin-btn"
    onclick="togglePinConversation(
      event,
      '${conversation.id}',
      ${conversation.is_pinned}
    )">

    ${conversation.is_pinned ? '📌' : '📍'}

  </button>

  <div class="conversation-time">
    ${formatDateTime(conversation.updated_at)}
</div>

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
    await loadConversations();

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
    class="chat-image"
    onclick="openChatImagePreview('${msg.image_url}')">
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

                const urlRegex = /(https?:\/\/[^\s]+)/g;

                if (urlRegex.test(msg.message)) {

                    const url = msg.message.match(urlRegex)[0];

                    const shortUrl = new URL(url).hostname;

                    content = `
            <a href="${url}" target="_blank">
                🔗 ${shortUrl}
            </a>
        `;

                } else {

                    content = escapeHtml(msg.message || "");
                }
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

                setTimeout(async () => {
                    await loadConversations();
                }, 500);

                if (
                    selectedConversationId &&
                    msg.conversation_id === selectedConversationId
                ) {

                    const existing =
                        document.querySelector(
                            `[data-chat-id="${msg.id}"]`
                        );

                    if (existing) return;

                    appendMessage(msg);

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

    div.dataset.chatId = msg.id;

    div.className =
        `chat-message ${msg.sender_type}`;

    if (msg.image_url) {

        div.innerHTML = `
        <img
            src="${msg.image_url}"
            class="chat-image"
            onclick="openChatImagePreview('${msg.image_url}')">
    `;

    }
    else if (msg.video_url) {

        div.innerHTML = `
            <video controls class="chat-video">
                <source src="${msg.video_url}">
            </video>
        `;

    }

    else {

        const urlRegex = /(https?:\/\/[^\s]+)/g;

        if (urlRegex.test(msg.message)) {

            const url = msg.message.match(urlRegex)[0];

            const shortUrl = new URL(url).hostname;

            div.innerHTML = `
            <a href="${url}" target="_blank">
                🔗 ${shortUrl}
            </a>
        `;

        } else {

            div.textContent = msg.message;
        }
    }

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

function formatDateTime(date) {

    if (!date) return "";

    return new Date(date).toLocaleString("en-PH", {
        month: "short",
        day: "2-digit",
        year: "numeric",
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

(async function initAdminChat() {

    const allowed = await checkAdminAccess();

    if (!allowed) return;

    loadConversations();

    subscribeRealtime();

    setInterval(loadConversations, 5000);

    subscribeTypingRealtime();

})();

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

    const input =
        document.getElementById("adminReplyInput");

    const panel =
        document.getElementById("adminEmojiPanel");

    if (!input) return;

    input.value += emoji;

    input.focus();

    panel.style.display = "none";
}

async function uploadAdminChatMedia(file) {

    if (!selectedConversationId) {
        alert("Select conversation first.");
        return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
        alert("Image or video only.");
        return;
    }

    const folder = isImage ? "admin-images" : "admin-videos";
    const fileName = `${Date.now()}-${file.name}`;
    const path = `${folder}/${fileName}`;

    const { error: uploadError } = await supabaseClient
        .storage
        .from("chat-media")
        .upload(path, file);

    if (uploadError) {
        console.error("Admin upload error:", uploadError);
        alert("Upload failed.");
        return;
    }

    const { data: publicData } = supabaseClient
        .storage
        .from("chat-media")
        .getPublicUrl(path);

    const url = publicData.publicUrl;

    const { data, error } = await supabaseClient
        .from("chat_messages")
        .insert({
            conversation_id: selectedConversationId,
            sender_type: "admin",
            message: isImage ? "📷 Image" : "🎥 Video",
            image_url: isImage ? url : null,
            video_url: isVideo ? url : null,
            is_read: false
        })
        .select()
        .single();

    if (error) {
        console.error("Admin media insert error:", error);
        alert("Media send failed.");
        return;
    }

    appendMessage(data);

    await supabaseClient
        .from("chat_conversations")
        .update({
            updated_at: new Date().toISOString(),
            last_message: isImage ? "📷 Image" : "🎥 Video"
        })
        .eq("id", selectedConversationId);
}

document
    .getElementById("adminChatFileInput")
    ?.addEventListener("change", async function (event) {

        const file = event.target.files?.[0];

        if (!file) return;

        await uploadAdminChatMedia(file);

        event.target.value = "";
    });

async function togglePinConversation(
    event,
    conversationId,
    pinned
) {

    event.stopPropagation();

    await supabaseClient
        .from("chat_conversations")
        .update({
            is_pinned: !pinned
        })
        .eq("id", conversationId);

    loadConversations();
}