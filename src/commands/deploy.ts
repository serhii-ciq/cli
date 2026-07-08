import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import archiver from "archiver";
import axios from "axios";
import chalk from "chalk";
import type { Command } from "commander";
import FormData from "form-data";
import { apiGet, apiPost, apiPostMultipart, readAuthConfig } from "../client.js";

const CLI_VERSION = JSON.parse(
	fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version as string;

function extractApiMessage(err: unknown): { short: string; full: string } {
	if (!axios.isAxiosError(err)) {
		const msg = String(err);
		return { short: msg, full: msg };
	}
	const status = err.response?.status;
	const data = err.response?.data;
	const full = data ? `API ${status}: ${JSON.stringify(data)}` : `API ${status}: ${err.message}`;

	if (!data) return { short: full, full };

	// tRPC format: { error: { json: { message } } }  or  [{ error: { json: { message } } }]
	const errObj = Array.isArray(data) ? data[0]?.error : data?.error;
	const msg = errObj?.json?.message ?? errObj?.message;
	if (msg) return { short: `API ${status}: ${msg}`, full };

	if (data?.message) return { short: `API ${status}: ${data.message}`, full };
	if (typeof data === "string" && data.length < 500) return { short: `API ${status}: ${data}`, full };

	return { short: full, full };
}

const CONFIG_DIR = ".dokploy";
const CONFIG_FILE = "config.json";

const ZIP_EXCLUDE_GLOBS = [
	".git/**",
	"node_modules/**",
	".dokploy/**",
	".next/**",
	".env",
];

interface DeployConfig {
	projectId: string;
	environmentId: string;
	applicationId: string;
	appName: string;
	buildType: string;
	url: string;
}

function resolveConfigPath(directory: string): string {
	return path.join(directory, CONFIG_DIR, CONFIG_FILE);
}

function readDeployConfig(directory: string): DeployConfig | null {
	const configPath = resolveConfigPath(directory);
	if (!fs.existsSync(configPath)) return null;
	return JSON.parse(fs.readFileSync(configPath, "utf8")) as DeployConfig;
}

function writeDeployConfig(directory: string, config: DeployConfig): void {
	const configDir = path.join(directory, CONFIG_DIR);
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}
	fs.writeFileSync(
		resolveConfigPath(directory),
		JSON.stringify(config, null, 2),
	);
}

async function createZip(directory: string): Promise<string> {
	const tmpFile = path.join(os.tmpdir(), `dokploy-deploy-${Date.now()}.zip`);
	const output = fs.createWriteStream(tmpFile);
	const archive = archiver("zip", { zlib: { level: 9 } });

	return new Promise((resolve, reject) => {
		output.on("close", () => resolve(tmpFile));
		archive.on("error", reject);
		archive.pipe(output);
		archive.glob("**/*", {
			cwd: directory,
			dot: true,
			ignore: ZIP_EXCLUDE_GLOBS,
		});
		archive.finalize();
	});
}

async function uploadZip(
	applicationId: string,
	zipPath: string,
): Promise<void> {
	const form = new FormData();
	form.append("applicationId", applicationId);
	form.append("zip", fs.createReadStream(zipPath), {
		filename: "deploy.zip",
		contentType: "application/zip",
	});
	await apiPostMultipart("application.dropDeployment", form);
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000;

async function getAppStatus(applicationId: string): Promise<string> {
	const auth = readAuthConfig();
	const res = await axios.get(`${auth.url}/api/application.one`, {
		params: { applicationId },
		headers: { "x-api-key": auth.token },
	});
	return res.data?.applicationStatus ?? "unknown";
}

async function waitForBuild(applicationId: string): Promise<void> {
	const start = Date.now();
	process.stdout.write(chalk.blue("Building"));

	while (Date.now() - start < POLL_TIMEOUT_MS) {
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

		const status = await getAppStatus(applicationId);

		if (status === "done") {
			process.stdout.write("\n");
			console.log(chalk.green("Build completed."));
			return;
		}

		if (status === "error") {
			process.stdout.write("\n");
			throw new Error("Build failed. Check logs: dokploy deployment all --applicationId " + applicationId);
		}

		process.stdout.write(chalk.blue("."));
	}

	process.stdout.write("\n");
	throw new Error("Build timed out after 5 minutes.");
}

export function registerDeployCommand(program: Command) {
	program
		.command("deploy [directory]")
		.description("Deploy a directory to Dokploy (creates project, app, and domain on first run)")
		.option("--name <name>", "Project and application name (default: directory basename)")
		.option("--build-type <type>", "Build type: static, railpack, dockerfile", "static")
		.option("--publish-dir <dir>", "Publish directory for static sites", ".")
		.option("--port <port>", "Application port for domain", "80")
		.option("--spa", "Enable SPA mode (nginx try_files fallback to index.html)")
		.option("--json", "Output raw JSON")
		.option("--debug", "Show full API error responses")
		.action(async (directory: string | undefined, opts: {
			name?: string;
			buildType: string;
			publishDir: string;
			port: string;
			spa?: boolean;
			json?: boolean;
			debug?: boolean;
		}) => {
			const auth = readAuthConfig();
			console.log(chalk.gray(`dokploy-cli v${CLI_VERSION}  →  ${auth.url}`));

			const targetDir = path.resolve(directory ?? ".");
			if (!fs.existsSync(targetDir)) {
				console.error(chalk.red(`Directory not found: ${targetDir}`));
				process.exit(1);
			}

			const appName = opts.name ?? path.basename(targetDir);
			const port = Number.parseInt(opts.port, 10);
			const jsonOutput = opts.json ?? false;
			const debug = opts.debug ?? false;

			try {
				let config = readDeployConfig(targetDir);

				if (config) {
					await redeployExisting(config, targetDir, jsonOutput);
				} else {
					config = await deployNew(targetDir, appName, opts.buildType, opts.publishDir, port, opts.spa ?? false, jsonOutput);
					writeDeployConfig(targetDir, config);
				}
			} catch (err) {
				const { short, full } = extractApiMessage(err);
				console.error(chalk.red(short));
				if (debug && full !== short) {
					console.error(chalk.gray(full));
				}
				process.exit(1);
			}
		});
}

async function deployNew(
	directory: string,
	name: string,
	buildType: string,
	publishDir: string,
	port: number,
	spa: boolean,
	jsonOutput: boolean,
): Promise<DeployConfig> {
	console.log(chalk.blue(`Creating project "${name}"...`));
	const project = await apiPost("project.create", { name }) as {
		project: { projectId: string };
		environment: { environmentId: string };
	};
	const { projectId } = project.project;
	const { environmentId } = project.environment;

	console.log(chalk.blue("Creating application..."));
	const app = await apiPost("application.create", {
		name,
		appName: name,
		environmentId,
	}) as { applicationId: string; appName: string };
	const { applicationId, appName } = app;

	console.log(chalk.blue(`Setting build type to "${buildType}"...`));
	await apiPost("application.saveBuildType", {
		applicationId,
		buildType,
		publishDirectory: publishDir,
		isStaticSpa: spa,
		dockerfile: "Dockerfile",
		dockerContextPath: ".",
		dockerBuildStage: "",
		herokuVersion: "24",
		railpackVersion: "0.15.4",
	});

	console.log(chalk.blue("Creating archive..."));
	const zipPath = await createZip(directory);
	const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
	console.log(chalk.blue(`Uploading ${zipSizeMB} MB...`));

	try {
		await uploadZip(applicationId, zipPath);
	} finally {
		fs.unlinkSync(zipPath);
	}

	await waitForBuild(applicationId);

	const host = `${appName}.cloud.creatoriq.com`;
	console.log(chalk.blue(`Creating domain ${host}...`));
	await apiPost("domain.create", {
		host,
		path: "/",
		internalPath: "/",
		port,
		https: true,
		certificateType: "custom",
		customCertResolver: "ACM",
		applicationId,
		domainType: "application",
	});

	const url = `https://${host}`;
	const config: DeployConfig = {
		projectId,
		environmentId,
		applicationId,
		appName,
		buildType,
		url,
	};

	if (jsonOutput) {
		console.log(JSON.stringify(config, null, 2));
	} else {
		console.log(chalk.green(`\nDeployed to ${url}`));
		console.log(chalk.gray("Config saved to .dokploy/config.json"));
	}

	return config;
}

async function redeployExisting(
	config: DeployConfig,
	directory: string,
	jsonOutput: boolean,
): Promise<void> {
	console.log(chalk.blue(`Redeploying ${config.appName}...`));

	const zipPath = await createZip(directory);
	const zipSizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(2);
	console.log(chalk.blue(`Uploading ${zipSizeMB} MB...`));

	try {
		await uploadZip(config.applicationId, zipPath);
	} finally {
		fs.unlinkSync(zipPath);
	}

	await waitForBuild(config.applicationId);

	if (jsonOutput) {
		console.log(JSON.stringify({ applicationId: config.applicationId, url: config.url }, null, 2));
	} else {
		console.log(chalk.green(`\nDeployed to ${config.url}`));
	}
}
