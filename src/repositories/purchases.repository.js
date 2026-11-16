const pool = require('../config/db');

async function findAll() {
    const [rows] = await pool.query(`
        SELECT
            purchase.id,
            purchase.user_id,
            user.name AS user_name,
            CURRENT_TIMESTAMP AS purchased_at,
            purchase.status,
            COALESCE(purchase.price_paid, game.price, 0) AS total_amount,
            1 AS item_count,
            JSON_ARRAY(
                JSON_OBJECT(
                    'item_id', purchase.id,
                    'game_id', game.id,
                    'game_name', game.name,
                    'price_paid', COALESCE(purchase.price_paid, game.price, 0)
                )
            ) AS items
        FROM purchase
        INNER JOIN \`user\` ON user.id = purchase.user_id
        LEFT JOIN game ON game.id = purchase.game_id
        ORDER BY purchase.id DESC
    `);

    return rows;
}

async function findById(id) {
    const [rows] = await pool.query(`
        SELECT
            purchase.id,
            purchase.user_id,
            user.name AS user_name,
            CURRENT_TIMESTAMP AS purchased_at,
            purchase.status,
            COALESCE(purchase.price_paid, game.price, 0) AS total_amount,
            1 AS item_count,
            JSON_ARRAY(
                JSON_OBJECT(
                    'item_id', purchase.id,
                    'game_id', game.id,
                    'game_name', game.name,
                    'price_paid', COALESCE(purchase.price_paid, game.price, 0)
                )
            ) AS items
        FROM purchase
        INNER JOIN \`user\` ON user.id = purchase.user_id
        LEFT JOIN game ON game.id = purchase.game_id
        WHERE purchase.id = ?
    `, [id]);

    return rows[0] || null;
}

async function findByUserId(userId) {
    const [rows] = await pool.query(`
        SELECT
            purchase.id,
            purchase.user_id,
            user.name AS user_name,
            CURRENT_TIMESTAMP AS purchased_at,
            purchase.status,
            COALESCE(purchase.price_paid, game.price, 0) AS total_amount,
            1 AS item_count,
            JSON_ARRAY(
                JSON_OBJECT(
                    'item_id', purchase.id,
                    'game_id', game.id,
                    'game_name', game.name,
                    'price_paid', COALESCE(purchase.price_paid, game.price, 0)
                )
            ) AS items
        FROM purchase
        INNER JOIN \`user\` ON user.id = purchase.user_id
        LEFT JOIN game ON game.id = purchase.game_id
        WHERE purchase.user_id = ?
        ORDER BY purchase.id DESC
    `, [userId]);

    return rows;
}

async function findSalesByDate(date) {
    const [rows] = await pool.query(`
        SELECT
            purchase.id AS purchase_id,
            purchase.user_id,
            purchase.id AS item_id,
            purchase.game_id,
            game.name AS game_name,
            CURRENT_DATE() AS sale_date,
            COALESCE(purchase.price_paid, game.price, 0) AS amount,
            purchase.status
        FROM purchase
        INNER JOIN game ON game.id = purchase.game_id
        WHERE purchase.status = 'completed'
        ORDER BY purchase.id DESC
    `);

    return rows;
}

async function create(purchaseData) {
    const { user_id, items, status } = purchaseData;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const firstItem = items && items[0] ? items[0] : null;
        const gameId = firstItem ? (firstItem.game_id || firstItem.id) : null;

        if (!gameId) {
            throw new Error('No se especificó un videojuego válido para la compra.');
        }

        const [gameRows] = await connection.query(
            'SELECT price FROM game WHERE id = ?',
            [gameId]
        );

        if (gameRows.length === 0) {
            throw new Error(`El videojuego ${gameId} no existe.`);
        }

        const pricePaid = gameRows[0].price != null ? gameRows[0].price : 0.00;

        const [purchaseResult] = await connection.query(`
            INSERT INTO purchase (user_id, game_id, price_paid, status)
            VALUES (?, ?, ?, ?)
        `, [user_id, gameId, pricePaid, status || 'completed']);

        const purchaseId = purchaseResult.insertId;

        await connection.commit();

        return await findById(purchaseId);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function update(id, purchaseData) {
    const { user_id, items, status } = purchaseData;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const firstItem = items && items[0] ? items[0] : null;
        const gameId = firstItem ? (firstItem.game_id || firstItem.id) : null;

        let pricePaid = 0.00;
        if (gameId) {
            const [gameRows] = await connection.query(
                'SELECT price FROM game WHERE id = ?',
                [gameId]
            );
            if (gameRows.length > 0 && gameRows[0].price != null) {
                pricePaid = gameRows[0].price;
            }
        }

        const [result] = await connection.query(`
            UPDATE purchase
            SET user_id = ?, game_id = ?, price_paid = ?, status = ?
            WHERE id = ?
        `, [user_id, gameId, pricePaid, status, id]);

        if (result.affectedRows === 0) {
            const [existingRows] = await connection.query(
                'SELECT id FROM purchase WHERE id = ?',
                [id]
            );

            if (existingRows.length === 0) {
                await connection.rollback();
                return null;
            }
        }

        await connection.commit();

        return await findById(id);
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function remove(id) {
    const [result] = await pool.query(
        'DELETE FROM purchase WHERE id = ?',
        [id]
    );

    return result.affectedRows > 0;
}

module.exports = {
    findAll,
    findById,
    findByUserId,
    findSalesByDate,
    create,
    update,
    remove
};