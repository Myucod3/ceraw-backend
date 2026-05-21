import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import r2 from "./r2.js";
import cors from "cors";
import express from "express";
import pool from "./db.js";

import http from "http";
import { Server } from "socket.io"

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.json());
app.use(cors());

console.log("BUCKET:", process.env.R2_BUCKET);

const upload = multer({ storage: multer.memoryStorage() });

app.get("/",  (req, res) => {
    res.json({message: "сервер работает"});
});

app.get("/drawings", async (req, res) => {
    const result = await pool.query("SELECT * FROM drawings ORDER BY created_at DESC");
    res.json(result.rows);
});

app.post("/drawings", upload.single("image"), async (req, res) => {
    const file = req.file;
    const key = `${Date.now()}-${file.originalname}`;

    await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));

    const url = `${process.env.R2_PUBLIC_URL}/${key}`;
    await pool.query("INSERT INTO drawings (url) VALUES ($1)", [url]);

    const drawing = { url };
    
    io.emit("new-post",drawing);

    res.json(drawing);
})

io.on("connection", socket => {
    console.log("user connected");
});

server.listen(3000, async () => {
    const client = await pool.connect();
    console.log("БД подключена");
    client.release();
    console.log("Сервер запущен на порту 3000");
});