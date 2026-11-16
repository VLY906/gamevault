
const pool = require('../config/db');

async function findAll() {
    const [rows] = await pool.query(`
        SELECT
            purchase.id,
            purchase.user_id,
            user.name AS user_name,
            purchase.purchased_at,
            purchase.status,
            COALESCE((
                SELECT SUM(pi.price_paid)
                FROM purchase_item pi
                WHERE pi.purchase_id = purchase.id
            ), 0) AS total_amount,
            (
                SELECT COUNT(*)
                FROM purchase_item pi
                WHERE pi.purchase_id = purchase.id
            ) AS item_count,
            COALESCE((
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'item_id', pi.id,
                        'game_id', game.id,
                        'game_name', game.name,
                        'price_paid', pi.price_paid
                    )
                )
                FROM purchase_item pi
                INNER JOIN game ON game.id = pi.game_id
                WHERE pi.purchase_id = purchase.id
            ), JSON_ARRAY()) AS items
        FROM purchase
        INNER JOIN \`user\` ON user.id = purchase.user_id
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
            purchase.purchased_at,
            purchase.status,
            COALESCE((
                SELECT SUM(pi.price_paid)
                FROM purchase_item pi
                WHERE pi.purchase_id = purchase.id
            ), 0) AS total_amount,
            (
                SELECT COUNT(*)
                FROM purchase_item pi
                WHERE pi.purchase_id = purchase.id
            ) AS item_count,
            COALESCE((
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'item_id', pi.id,
                        'game_id', game.id,
                        'game_name', game.name,
                        'price_paid', pi.price_paid
                    )
                )
                FROM purchase_item pi
                INNER JOIN game ON game.id = pi.game_id
                WHERE pi.purchase_id = purchase.id
            ), JSON_ARRAY()) AS items
        FROM purchase
        INNER JOIN \`user\` ON user.id = purchase.user_id
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
            purchase.purchased_at,
            purchase.status,
            COALESCE((
                SELECT SUM(pi.price_paid)
                FROM purchase_item pi
                WHERE pi.purchase_id = purchase.id
            ), 0) AS total_amount,
            (
                SELECT COUNT(*)
                FROM purchase_item pi
                WHERE pi.purchase_id = purchase.id
            ) AS item_count,
            COALESCE((
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'item_id', pi.id,
                        'game_id', game.id,
                        'game_name', game.name,
                        'price_paid', pi.price_paid
                    )
                )
                FROM purchase_item pi
                INNER JOIN game ON game.id = pi.game_id
                WHERE pi.purchase_id = purchase.id
            ), JSON_ARRAY()) AS items
        FROM purchase
        INNER JOIN \`user\` ON user.id = purchase.user_id
        WHERE purchase.user_id = ?
        ORDER BY purchase.id DESC
    `, [userId]);

    return rows;
}

async function findSalesByDate(date) {
    const query = `
        SELECT
            purchase.id AS purchase_id,
            purchase.user_id,
            pi.id AS item_id,
            pi.game_id,
            game.name AS game_name,
            purchase.purchased_at AS sale_date,
            pi.price_paid AS amount,
            purchase.status
        FROM purchase
        INNER JOIN purchase_item pi
            ON pi.purchase_id = purchase.id
        INNER JOIN game
            ON game.id = pi.game_id
        WHERE purchase.status = 'completed'
        ${date ? 'AND DATE(purchase.purchased_at) = ?' : ''}
        ORDER BY purchase.id DESC
    `;

    const [rows] = await pool.query(query, date ? [date] : []);

    return rows;
}

async function insertPurchaseItems(connection, purchaseId, items) {
    for (const item of items) {
        const gameId = item.game_id || item.id || item.gameId;

        const [gameRows] = await connection.query(
            'SELECT price FROM game WHERE id = ?',
            [gameId]
        );

        if (gameRows.length === 0) {
            throw new Error(`El videojuego ${gameId} no existe.`);
        }

        await connection.query(`
            INSERT INTO purchase_item
                (purchase_id, game_id, price_paid)
            VALUES (?, ?, ?)
        `, [purchaseId, gameId, gameRows[0].price]);
    }
}

async function create(purchaseData) {
    const { user_id, items, status } = purchaseData;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        if (!items || items.length === 0) {
            throw new Error('No se especificaron videojuegos para la compra.');
        }

        const [purchaseResult] = await connection.query(`
            INSERT INTO purchase (user_id, status)
            VALUES (?, ?)
        `, [user_id, status || 'completed']);

        const purchaseId = purchaseResult.insertId;

        await insertPurchaseItems(connection, purchaseId, items);

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

        const [result] = await connection.query(`
            UPDATE purchase
            SET user_id = ?, status = ?
            WHERE id = ?
        `, [user_id, status, id]);

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

        if (items !== undefined) {
            await connection.query(
                'DELETE FROM purchase_item WHERE purchase_id = ?',
                [id]
            );

            await insertPurchaseItems(connection, id, items);
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
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(
            'DELETE FROM purchase_item WHERE purchase_id = ?',
            [id]
        );

        const [result] = await connection.query(
            'DELETE FROM purchase WHERE id = ?',
            [id]
        );

        await connection.commit();

        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
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
