const API_URL = 'https://gamevault-8zox.onrender.com';

const detailContainer = document.getElementById('gameDetail');

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[character]);
}

function formatPrice(price) {
    const amount = Number(price);

    if (!Number.isFinite(amount)) {
        return 'Precio no disponible';
    }

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

async function getGame(id) {
    try {
        const response = await fetch(
            `${API_URL}/games/${encodeURIComponent(id)}`
        );

        if (response.ok) {
            const data = await response.json();

            if (data && !Array.isArray(data)) {
                return data.game || data;
            }
        }
    } catch (error) {
        console.warn('No fue posible consultar el videojuego individual.');
    }

    const response = await fetch(`${API_URL}/games`);

    if (!response.ok) {
        throw new Error('No fue posible consultar el catálogo.');
    }

    const data = await response.json();

    const games = Array.isArray(data)
        ? data
        : Array.isArray(data.games)
            ? data.games
            : [];

    return games.find(game => String(game.id) === String(id));
}

async function loadGameReviews(gameId) {
    try {
        const response = await fetch(`${API_URL}/reviews/game/${gameId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Error al cargar reseñas:', error);
        return [];
    }
}

function renderGame(game, reviews = []) {
    if (!game) {
        detailContainer.innerHTML = `
            <div class="detail-message">
                <h2>Videojuego no encontrado</h2>
                <p>El videojuego que buscas no está disponible.</p>
                <a href="index.html#catalogo" class="detail-button">
                    Regresar al catálogo
                </a>
            </div>
        `;
        return;
    }

    const storedUser = sessionStorage.getItem('gamevault_user');
    const user = storedUser ? JSON.parse(storedUser) : null;

    const reviewsHTML = reviews.length > 0 ? reviews.map(r => `
        <div class="review-card">
            <div class="review-header">
                <strong>Usuario #${escapeHTML(r.user_id)}</strong>
                <span class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            </div>
            <p class="review-comment">${escapeHTML(r.comment || 'Sin comentarios.')}</p>
            <small>Horas jugadas: ${r.hours_played || 0} hrs</small>
        </div>
    `).join('') : '<p class="empty-reviews">Sé el primero en dejar una reseña para este juego.</p>';

    detailContainer.innerHTML = `
        <article class="game-detail">

            <div class="detail-art">
                <span>${escapeHTML(game.name)}</span>
            </div>

            <div class="detail-information">

                <span class="detail-label">GAMEVAULT COLLECTION</span>

                <h1>${escapeHTML(game.name)}</h1>

                <p class="detail-genre">
                    ${escapeHTML(game.genre || 'Género no especificado')}
                </p>

                <div class="detail-divider"></div>

                <h3>Descripción</h3>

                <p class="detail-description">
                    ${escapeHTML(game.description || 'No hay una descripción disponible.')}
                </p>

                <div class="detail-data">
                    <div>
                        <span>Clasificación</span>
                        <strong>${escapeHTML(game.age_rating || 'No especificada')}</strong>
                    </div>

                    <div>
                        <span>Identificador</span>
                        <strong>${escapeHTML(game.id)}</strong>
                    </div>
                </div>

                <div class="detail-purchase">
                    <span class="detail-price">
                        ${formatPrice(game.price)}
                    </span>

                    <button
                        type="button"
                        class="detail-button"
                        id="buyGameButton"
                        ${!user ? 'disabled' : ''}
                        title="${user ? 'Comprar este videojuego' : 'Inicia sesión para poder comprar.'}"
                    >
                        ${user ? 'Comprar ahora' : 'Inicia sesión para comprar'}
                    </button>
                </div>

                <p class="detail-note" id="purchaseMessage">
                    ${user ? '' : 'Debes iniciar sesión para realizar compras.'}
                </p>

            </div>
        </article>

        <!-- SECCIÓN DE RESEÑAS -->
        <section class="game-reviews-section">
            <h2>Reseñas y Calificaciones</h2>
            
            <div class="reviews-list">
                ${reviewsHTML}
            </div>

            ${user ? `
                <form id="reviewForm" class="review-form">
                    <h3>Deja tu reseña</h3>
                    <div class="form-group">
                        <label for="reviewRating">Calificación (1 a 5):</label>
                        <select id="reviewRating" required>
                            <option value="5">5 - ¡Excelente!</option>
                            <option value="4">4 - Muy bueno</option>
                            <option value="3">3 - Bueno</option>
                            <option value="2">2 - Regular</option>
                            <option value="1">1 - Malo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="reviewHours">Horas jugadas:</label>
                        <input type="number" id="reviewHours" min="0" value="10" required />
                    </div>
                    <div class="form-group">
                        <label for="reviewComment">Comentario:</label>
                        <textarea id="reviewComment" rows="3" placeholder="¿Qué te pareció el juego?"></textarea>
                    </div>
                    <button type="submit" class="detail-button">Publicar reseña</button>
                    <p id="reviewMessage" class="detail-note"></p>
                </form>
            ` : `
                <p class="detail-note">Inicia sesión para dejar tu propia reseña y calificación.</p>
            `}
        </section>
    `;

    if (user) {
        const buyButton = document.getElementById('buyGameButton');
        const purchaseMessage = document.getElementById('purchaseMessage');

        buyButton.addEventListener('click', async () => {
            buyButton.disabled = true;
            buyButton.textContent = 'Procesando compra...';

            try {
                const response = await fetch(`${API_URL}/purchases`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('gamevault_token')}`
                    },
                    body: JSON.stringify({
                        user_id: Number(user.id),
                        status: 'completed',
                        items: [
                            {
                                game_id: Number(game.id)
                            }
                        ]
                    })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'No se pudo completar la compra.');

                purchaseMessage.className = 'detail-note success-text';
                purchaseMessage.textContent = '¡Compra realizada con éxito!';
                buyButton.textContent = '¡Comprado!';
            } catch (error) {
                purchaseMessage.className = 'detail-note error-text';
                purchaseMessage.textContent = error.message;
                buyButton.disabled = false;
                buyButton.textContent = 'Comprar ahora';
            }
        });

        const reviewForm = document.getElementById('reviewForm');
        reviewForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = Number(document.getElementById('reviewRating').value);
            const hours_played = Number(document.getElementById('reviewHours').value);
            const comment = document.getElementById('reviewComment').value.trim();
            const reviewMessage = document.getElementById('reviewMessage');

            try {
                const response = await fetch(`${API_URL}/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('gamevault_token')}`
                    },
                    body: JSON.stringify({
                        user_id: Number(user.id),
                        game_id: Number(game.id),
                        rating,
                        hours_played,
                        comment
                    })
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'No se pudo guardar la reseña.');

                reviewMessage.className = 'detail-note success-text';
                reviewMessage.textContent = '¡Reseña publicada con éxito!';
                
                setTimeout(() => location.reload(), 1000);
            } catch (error) {
                reviewMessage.className = 'detail-note error-text';
                reviewMessage.textContent = error.message;
            }
        });
    }
}

async function loadGameDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id || !/^\d+$/.test(id)) {
        detailContainer.innerHTML = `
            <div class="detail-message">
                <h2>Identificador inválido</h2>
                <p>No se indicó un videojuego válido.</p>
                <a href="index.html#catalogo" class="detail-button">
                    Regresar al catálogo
                </a>
            </div>
        `;
        return;
    }

    try {
        const game = await getGame(id);
        const reviews = game ? await loadGameReviews(game.id) : [];
        renderGame(game, reviews);
    } catch (error) {
        console.error('Error al cargar la ficha:', error);

        detailContainer.innerHTML = `
            <div class="detail-message">
                <h2>No fue posible cargar el videojuego</h2>
                <p>Verifica que el servidor de GameVault esté funcionando.</p>
                <button class="detail-button" onclick="loadGameDetail()">
                    Reintentar
                </button>
            </div>
        `;
    }
}

loadGameDetail();