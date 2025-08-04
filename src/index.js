import express from "express";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);
import dotenv from "dotenv";
import { protectedRoute, generateToken } from "./middleware.js";
import { Server } from "socket.io";
import Redis from "ioredis";
import { db } from "./db/db.js";
import { users, projects } from "./db/schema.js";
import { eq } from "drizzle-orm";
import axios from "axios";
import cors from "cors";
import { generateSlug } from "random-word-slugs";
import { createServer } from "http";
dotenv.config();

const app = express();
const PORT = 9000;
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});
app.use(express.json());

const subscriber = new Redis(process.env.REDIS_URL);

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});
io.listen(9001, () => console.log("Socket Server 9001"));

app.get("/auth/github", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const { data: tokenData } = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (tokenData.error || !tokenData.access_token) {
      return res.status(400).json({ error: "Failed to retrieve access token" });
    }

    const accessToken = tokenData.access_token;

    const { data } = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    const user = {
      id: data.id,
      avatar: data.avatar_url,
      username: data.login,
      email: data.email,
      name: data.name,
      twitter_username: data.twitter_username,
      created_at: new Date().toISOString(),
    };

    const token = generateToken(user.id);

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: user.id,
        avatar: user.avatar,
        username: user.username,
        email: user.email,
        name: user.name,
        twitter_username: user.twitter_username,
      });
    }

    const redirectUrl = `${process.env.FRONTEND_URL}/auth?token=${token}&avatar=${user.avatar}&username=${user.username}`;
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("GitHub OAuth Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/build-project", protectedRoute, async (req, res) => {
  const { git_url, is_public, slug, env_vars } = req.body;

  if (!git_url) {
    return res.status(400).send("Fill all fields");
  }
  const projectSlug = slug ? slug : generateSlug();

  let env = null;
  if (env_vars) {
    env = JSON.stringify(env_vars);
  }

  const projectSlugExists = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, projectSlug));

  const values = {
    user_id: req.user.id,
    slug: projectSlug,
    is_public,
    git_url,
    env,
  };

  if (projectSlugExists.length > 0) {
    if (projectSlugExists[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    await db.update(projects).set(values).where(eq(projects.slug, projectSlug));
  } else {
    await db.insert(projects).values(values);
  }
  const command = `docker run -d --rm --network=host\
    -e GIT_REPOSITORY__URL=${git_url}\
    -e PROJECT_ID=${projectSlug}\
    -e ENV_VARS='${env}'\
    -e accessKeyId=${process.env.accessKeyId}\
    -e secretAccessKey=${process.env.secretAccessKey} build-server`;

  try {
    const { stdout, stderr } = await execAsync(command);
    console.log("✅ Command executed successfully:");
    console.log("stdout:", stdout);
    if (stderr) console.warn("stderr:", stderr);
  } catch (error) {
    console.error("❌ Failed to execute command:");
    console.error("error.message:", error.message);
    console.error("stderr:", error.stderr);
    console.error("stdout:", error.stdout);
  }

  console.log(`projectSlug: ${projectSlug}`);

  return res.json({
    status: "queued",
    data: { projectSlug },
  });
});

app.get("/projects", protectedRoute, async (req, res) => {
  try {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.user_id, req.user.id));

    res.json({
      success: true,
      data: userProjects,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.get("/projects/:slug", protectedRoute, async (req, res) => {
  try {
    const { slug } = req.params;
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug));

    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check if the project belongs to the authenticated user
    if (project[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      success: true,
      data: project[0],
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

app.get("/api/check-slug", protectedRoute, async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ error: "Slug parameter is required" });
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({
        error:
          "Invalid slug format. Use only lowercase letters, numbers, and hyphens.",
        available: false,
      });
    }

    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.slug, slug));

    if (existingProject.length === 0) {
      return res.json({
        available: true,
        slug,
      });
    }

    if (existingProject[0].user_id === req.user.id) {
      return res.json({
        available: true,
        slug,
      });
    } else {
      return res.json({
        available: false,
        slug,
      });
    }
  } catch (error) {
    console.error("Error checking slug availability:", error);
    res
      .status(500)
      .json({ error: "Failed to check slug availability", available: false });
  }
});

// app.use(express.static(path.join(__dirname, "./public")));

// app.get("*rest", (req, res) => {
//   res.sendFile(path.join(__dirname, "./public/index.html"));
// });

async function initRedisSubscribe() {
  console.log("Subscribed to logs....");
  subscriber.psubscribe("logs:*");
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

initRedisSubscribe();

app.listen(PORT, () => console.log(`API Server Running..${PORT}`));
