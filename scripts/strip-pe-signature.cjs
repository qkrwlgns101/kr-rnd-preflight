"use strict";

const fs = require("node:fs");

const file = process.argv[2];
if (!file) throw new Error("사용법: node strip-pe-signature.cjs <exe>");
const buffer = fs.readFileSync(file);
if (buffer.toString("ascii", 0, 2) !== "MZ") throw new Error("Windows PE 파일이 아닙니다.");
const peOffset = buffer.readUInt32LE(0x3c);
if (buffer.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") throw new Error("PE 헤더를 찾을 수 없습니다.");
const optionalOffset = peOffset + 24;
const magic = buffer.readUInt16LE(optionalOffset);
const directoryOffset = optionalOffset + (magic === 0x20b ? 112 : magic === 0x10b ? 96 : 0);
if (!directoryOffset) throw new Error(`지원하지 않는 PE optional header: 0x${magic.toString(16)}`);
const certificateEntry = directoryOffset + 8 * 4;
const certificateOffset = buffer.readUInt32LE(certificateEntry);
const certificateSize = buffer.readUInt32LE(certificateEntry + 4);
if (certificateOffset === 0 || certificateSize === 0) process.exit(0);
buffer.writeUInt32LE(0, certificateEntry);
buffer.writeUInt32LE(0, certificateEntry + 4);
const output = certificateOffset + certificateSize === buffer.length ? buffer.subarray(0, certificateOffset) : buffer;
fs.writeFileSync(file, output);
