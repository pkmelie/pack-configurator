(function() {
    // 1. Injection du style CSS pour le look "Robin & fils"
    const style = document.createElement('style');
    style.innerHTML = `
        /* 1. On importe une jolie police moderne depuis Google Fonts */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        #my-custom-chat-trigger { 
            position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; 
            background: #D32F2F; border-radius: 50%; cursor: pointer; 
            box-shadow: 0 4px 15px rgba(211, 47, 47, 0.4); display: flex; 
            align-items: center; justify-content: center; color: white; font-size: 26px; z-index: 999999; 
            transition: transform 0.2s ease;
        }
        #my-custom-chat-trigger:hover { transform: scale(1.05); }

        #my-custom-chat-box { 
            position: fixed; bottom: 90px; right: 20px; width: 360px; height: 520px; 
            background: #FFFFFF; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); 
            display: none; flex-direction: column; overflow: hidden; 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; /* Nouvelle police */
            z-index: 999999; 
        }

        #my-custom-chat-header { 
            background: #D32F2F; color: white; padding: 18px; 
            font-weight: 600; font-size: 15px; letter-spacing: -0.2px; 
        }
        #my-custom-chat-header sub { 
            display: block; font-size: 12px; opacity: 0.85; margin-top: 5px; 
            font-weight: 400; font-style: normal; 
        }

        #my-custom-chat-messages { 
            flex: 1; padding: 15px; overflow-y: auto; background: #F8F9FA; 
            display: flex; flex-direction: column; gap: 12px; 
        }

        /* Style des bulles de texte amélioré */
        .chat-msg { 
            padding: 10px 14px; border-radius: 14px; max-width: 80%; 
            font-size: 14px; line-height: 1.45; /* Meilleur espacement entre les lignes */
            word-wrap: break-word; 
        }
        .chat-msg.user { 
            background: #D32F2F; color: white; align-self: flex-end; 
            font-weight: 400; border-bottom-right-radius: 4px; 
        }
        .chat-msg.bot { 
            background: #FFFFFF; color: #2D3748; align-self: flex-start; /* Texte gris foncé, plus doux que noir pur */
            font-weight: 400; border-bottom-left-radius: 4px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.04); 
        }

        #my-custom-chat-input-area { 
            display: flex; border-top: 1px solid #EDF2F7; padding: 12px; background: white; align-items: center; 
        }
        #my-custom-chat-input { 
            flex: 1; border: 1px solid #E2E8F0; padding: 10px 14px; 
            border-radius: 24px; outline: none; font-size: 14px; 
            font-family: 'Inter', sans-serif; color: #2D3748; background: #F8F9FA; 
        }
        #my-custom-chat-input:focus { border-color: #D32F2F; background: white; }

        #my-custom-chat-send { 
            background: #D32F2F; color: white; border: none; width: 36px; height: 36px; 
            margin-left: 8px; border-radius: 50%; cursor: pointer; 
            display: flex; align-items: center; justify-content: center; font-size: 14px; 
        }
    `;
    document.head.appendChild(style);

    // 2. Injection du HTML de la bulle et de la fenêtre
    const chatContainer = document.createElement('div');
    chatContainer.innerHTML = `
        <div id="my-custom-chat-trigger">💬</div>
        <div id="my-custom-chat-box">
            <div id="my-custom-chat-header">
                Robin & fils Support Agent
                <sub>Notre agent IA est là pour répondre à vos questions !</sub>
            </div>
            <div id="my-custom-chat-messages">
                <div class="chat-msg bot">Bonjour ! Comment puis-je vous aider aujourd'hui ?</div>
            </div>
            <div id="my-custom-chat-input-area">
                <input type="text" id="my-custom-chat-input" placeholder="Écrivez votre message...">
                <button id="my-custom-chat-send">▶</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    // 3. Logique d'ouverture / fermeture et d'envoi
    const trigger = document.getElementById('my-custom-chat-trigger');
    const chatBox = document.getElementById('my-custom-chat-box');
    const input = document.getElementById('my-custom-chat-input');
    const sendBtn = document.getElementById('my-custom-chat-send');
    const messagesContainer = document.getElementById('my-custom-chat-messages');

    trigger.addEventListener('click', () => {
        chatBox.style.display = chatBox.style.display === 'flex' ? 'none' : 'flex';
    });

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // Afficher le message utilisateur
        appendMessage(text, 'user');
        input.value = '';

        // Envoyer la requête vers TON serveur backend
        try {
            const response = await fetch('http://127.0.0.1:5000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();
            appendMessage(data.reply, 'bot');
        } catch (error) {
            appendMessage("Désolé, une erreur est survenue.", 'bot');
        }
    }

    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('chat-msg', sender);
        msgDiv.innerText = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
})();