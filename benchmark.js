import { spawn } from "child_process";

// We simulate a large output
function oldMethod() {
  return new Promise((resolve) => {
    const child = spawn("node", ["-e", "for(let i=0;i<100000;i++) console.log('This is a test line ' + i);"]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString("utf-8");
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString("utf-8");
    });

    child.on("close", (code) => {
      resolve(stdout.length);
    });
  });
}

function newMethod() {
  return new Promise((resolve) => {
    const child = spawn("node", ["-e", "for(let i=0;i<100000;i++) console.log('This is a test line ' + i);"]);

    let stdoutChunks = [];
    let stderrChunks = [];

    child.stdout.on("data", (data) => {
      stdoutChunks.push(data);
    });

    child.stderr.on("data", (data) => {
      stderrChunks.push(data);
    });

    child.on("close", (code) => {
      let stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      resolve(stdout.length);
    });
  });
}

async function runBenchmark() {
  console.log("Warming up...");
  await oldMethod();
  await newMethod();

  console.log("Benchmarking old method...");
  const startOld = process.hrtime.bigint();
  await oldMethod();
  const endOld = process.hrtime.bigint();
  console.log(`Old method took: ${Number(endOld - startOld) / 1000000} ms`);

  console.log("Benchmarking new method...");
  const startNew = process.hrtime.bigint();
  await newMethod();
  const endNew = process.hrtime.bigint();
  console.log(`New method took: ${Number(endNew - startNew) / 1000000} ms`);
}

runBenchmark();
