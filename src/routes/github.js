import express from "express";
import { protectedRoute } from "../middleware.js";
import axios from "axios";

const GithubRouter = express.Router();

GithubRouter.get("/user/repos", protectedRoute, async (req, res) => {
  const githubToken = req.user.github_token;
  if (!githubToken) {
    return res.status(401).json({ error: "Missing GitHub token" });
  }

  try {
    const response = await axios.get(
      "https://api.github.com/user/repos?per_page=100",
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const sortedRepos = response.data.sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );

    const repos = sortedRepos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      language: repo.language,
      updated_at: repo.updated_at,
      default_branch: repo.default_branch,
      visibility: repo.visibility,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
        html_url: repo.owner.html_url,
      },
    }));

    res.json(repos);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch GitHub repositories" });
  }
});

GithubRouter.get(
  "/repos/:owner/:repo/branches",
  protectedRoute,
  async (req, res) => {
    const githubToken = req.user.github_token;
    const { owner, repo } = req.params;

    if (!githubToken) {
      return res.status(401).json({ error: "Missing GitHub token" });
    }

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      // Map minimal necessary info
      const branches = response.data.map((branch) => ({
        name: branch.name,
        protected: branch.protected,
        commitSha: branch.commit?.sha || null,
      }));

      res.json(branches);
    } catch (error) {
      console.error(error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch repository branches" });
    }
  }
);

GithubRouter.get(
  "/repos/:owner/:repo/contents",
  protectedRoute,
  async (req, res) => {
    const { owner, repo } = req.params;
    const path = req.query.path || "";
    const githubToken = req.user.github_token;

    if (!githubToken) {
      return res.status(401).json({ error: "Missing GitHub token" });
    }

    try {
      const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const githubRes = await axios.get(githubUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${githubToken}`,
        },
      });

      return res.json(githubRes.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json([]);
      }
      return res
        .status(500)
        .json({ error: "Failed to fetch repository contents" });
    }
  }
);

export default GithubRouter;
