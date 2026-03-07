#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const projectName = process.argv[2] || ".";
const targetDir = path.resolve(process.cwd(), projectName);
const templateDir = path.join(__dirname, "..", "template");

if (projectName !== "." && fs.existsSync(targetDir)) {
  console.error(`Error: Directory "${projectName}" already exists.`);
  process.exit(1);
}

if (projectName !== ".") {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(templateDir);

for (const file of files) {
  const src = path.join(templateDir, file);
  // Rename "gitignore" to ".gitignore" (npm strips .gitignore from packages)
  const destName = file === "gitignore" ? ".gitignore" : file;
  const dest = path.join(targetDir, destName);

  fs.copyFileSync(src, dest);
}

const name = projectName === "." ? path.basename(targetDir) : projectName;

console.log(`
Substreams SQL Sink created in ${projectName === "." ? "current directory" : projectName}

Next steps:

  ${projectName !== "." ? `cd ${projectName}\n  ` : ""}cp .env.example .env    # Add your SUBSTREAMS_API_TOKEN
  make up                 # Start Postgres + pgweb
  make setup              # Create tables
  make dev                # Stream data

Browse data at http://localhost:8081

Full tutorial: TUTORIAL.md
`);
