const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PoTokenController {
    constructor() {
        this.isYtDlpAvailable = false;
        this.checkYtDlpAvailability();
    }

    async checkYtDlpAvailability() {
        try {
            const { exec } = require('child_process');
            
            // First, try to install yt-dlp if it doesn't exist
            exec('which yt-dlp', (error, stdout) => {
                if (error || !stdout.trim()) {
                    console.log('⚠️ yt-dlp not found, installing...');
                    
                    // Try apt-get first (system package manager)
                    exec('apt-get update && apt-get install -y yt-dlp', (aptError, aptStdout, aptStderr) => {
                        if (!aptError) {
                            this.isYtDlpAvailable = true;
                            console.log('✅ yt-dlp installed successfully via apt-get');
                            console.log('📤 Install output:', aptStdout);
                        } else {
                            console.error('❌ Failed to install yt-dlp via apt-get:', aptError);
                            console.error('📥 Install stderr:', aptStderr);
                            
                            // Fallback: try pip with --break-system-packages
                            console.log('🔄 Trying pip with --break-system-packages...');
                            exec('pip install --break-system-packages yt-dlp', (pipError, pipStdout, pipStderr) => {
                                if (!pipError) {
                                    this.isYtDlpAvailable = true;
                                    console.log('✅ yt-dlp installed successfully via pip');
                                    console.log('📤 Install output:', pipStdout);
                                } else {
                                    console.error('❌ Failed to install yt-dlp via pip:', pipError);
                                    console.error('📥 Install stderr:', pipStderr);
                                    
                                    // Final fallback: try curl to local directory
                                    console.log('🔄 Trying curl to local directory...');
                                    exec('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp && chmod +x ./yt-dlp', (curlError) => {
                                        if (!curlError) {
                                            this.isYtDlpAvailable = true;
                                            console.log('✅ yt-dlp installed successfully via curl to local directory');
                                        } else {
                                            console.error('❌ Failed to install yt-dlp via curl:', curlError);
                                            this.isYtDlpAvailable = false;
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else {
                    // yt-dlp exists, check version
                    exec('yt-dlp --version', (versionError, versionStdout) => {
                        if (!versionError && versionStdout) {
                            this.isYtDlpAvailable = true;
                            console.log('✅ yt-dlp available for video processing:', versionStdout.trim());
                        } else {
                            console.warn('⚠️ yt-dlp found but version check failed, reinstalling...');
                            this.isYtDlpAvailable = false;
                            // Trigger reinstall
                            this.checkYtDlpAvailability();
                        }
                    });
                }
            });
        } catch (error) {
            console.error('❌ Error checking yt-dlp availability:', error);
            this.isYtDlpAvailable = false;
        }
    }

    async generatePoToken(videoUrl) {
        if (!this.isYtDlpAvailable) {
            throw new Error('yt-dlp not available for video processing');
        }

        try {
            console.log(`🔐 Processing video with yt-dlp: ${videoUrl}`);
            
            // Use yt-dlp for video processing
            const result = await this.runYtDlpWithEnhancedHeaders(videoUrl);
            
            if (result.success) {
                console.log('✅ Video processing successful');
                return {
                    success: true,
                    videoInfo: result.videoInfo,
                    downloadUrl: result.downloadUrl
                };
            } else {
                throw new Error('Failed to process video');
            }
        } catch (error) {
            console.error('❌ Video processing failed:', error);
            throw error;
        }
    }

    async runYtDlpWithEnhancedHeaders(videoUrl) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Enhanced yt-dlp command with anti-bot headers (same as download method)
            const ytDlpArgs = [
                '--dump-json',
                '--no-warnings',
                '--no-check-certificate',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                '--add-header', 'Accept-Language: en-US,en;q=0.9',
                '--add-header', 'Accept-Encoding: gzip, deflate, br',
                '--add-header', 'DNT: 1',
                '--add-header', 'Connection: keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests: 1',
                '--add-header', 'Sec-Fetch-Dest: document',
                '--add-header', 'Sec-Fetch-Mode: navigate',
                '--add-header', 'Sec-Fetch-Site: none',
                '--add-header', 'Cache-Control: max-age=0',
                videoUrl
            ];
            
            const ytDlpProcess = spawn('yt-dlp', ytDlpArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            ytDlpProcess.on('close', (code) => {
                if (code === 0 && stdout) {
                    try {
                        const videoData = JSON.parse(stdout);
                        
                        const result = {
                            success: true,
                            videoInfo: {
                                title: videoData.title,
                                duration: videoData.duration,
                                uploader: videoData.uploader,
                                view_count: videoData.view_count,
                                description: videoData.description ? videoData.description.substring(0, 200) + '...' : ''
                            },
                            downloadUrl: videoData.url || videoData.webpage_url,
                            formats: videoData.formats ? videoData.formats.length : 0
                        };
                        
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse yt-dlp output: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            ytDlpProcess.on('error', (error) => {
                reject(new Error(`yt-dlp process error: ${error.message}`));
            });
        });
    }

    async getVideoInfoWithPoToken(videoUrl) {
        try {
            const result = await this.generatePoToken(videoUrl);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async downloadWithPoToken(videoUrl, outputPath) {
        try {
            console.log(`📥 Downloading with yt-dlp: ${videoUrl}`);
            
            // First try Node.js yt-dlp
            try {
                return await this.downloadWithNodeYtDlp(videoUrl, outputPath);
            } catch (nodeError) {
                console.error(`❌ Node.js yt-dlp failed: ${nodeError.message}`);
                
                // Fallback to Python yt-dlp
                console.log('🔄 Trying Python yt-dlp fallback...');
                try {
                    return await this.downloadWithPythonYtDlp(videoUrl, outputPath);
                } catch (pythonError) {
                    console.error(`❌ Python yt-dlp also failed: ${pythonError.message}`);
                    throw new Error(`Both Node.js and Python yt-dlp failed. Node: ${nodeError.message}, Python: ${pythonError.message}`);
                }
            }
        } catch (error) {
            console.error(`❌ Download error: ${error.message}`);
            throw error;
        }
    }

    async downloadWithNodeYtDlp(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Enhanced yt-dlp download command with headers method
            const ytDlpArgs = [
                '--output', outputPath,
                '--format', 'best[ext=mp4]/best',
                '--no-warnings',
                '--no-check-certificate',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                '--add-header', 'Accept-Language: en-US,en;q=0.9',
                '--add-header', 'Accept-Encoding: gzip, deflate, br',
                '--add-header', 'DNT: 1',
                '--add-header', 'Connection: keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests: 1',
                '--add-header', 'Sec-Fetch-Dest: document',
                '--add-header', 'Sec-Fetch-Mode: navigate',
                '--add-header', 'Sec-Fetch-Site: none',
                '--add-header', 'Cache-Control: max-age=0',
                videoUrl
            ];
            
            console.log(`🔧 Node.js yt-dlp command: yt-dlp ${ytDlpArgs.join(' ')}`);
            
            // Try to use local yt-dlp first, then system yt-dlp
            const ytDlpPath = fs.existsSync('./yt-dlp') ? './yt-dlp' : 'yt-dlp';
            console.log(`🔧 Using yt-dlp path: ${ytDlpPath}`);
            
            const ytDlpProcess = spawn(ytDlpPath, ytDlpArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Node.js yt-dlp stdout: ${data.toString()}`);
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Node.js yt-dlp stderr: ${data.toString()}`);
            });
            
            ytDlpProcess.on('close', (code) => {
                console.log(`🔚 Node.js yt-dlp process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Node.js yt-dlp download successful: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-node-enhanced-headers',
                            fileSize: fs.statSync(outputPath).size
                        });
                    } else {
                        console.error(`❌ Node.js yt-dlp file not found or empty: ${outputPath}`);
                        reject(new Error('Node.js yt-dlp download completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Node.js yt-dlp failed with code ${code}: ${stderr}`);
                    reject(new Error(`Node.js yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            ytDlpProcess.on('error', (error) => {
                console.error(`❌ Node.js yt-dlp process error: ${error.message}`);
                reject(new Error(`Node.js yt-dlp process error: ${error.message}`));
            });
        });
    }

    async downloadWithPythonYtDlp(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Python script to download with yt-dlp
            const pythonScript = `
import yt_dlp
import sys
import os

try:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    ydl_opts = {
        "outtmpl": "${outputPath}",
        "format": "best[ext=mp4]/best",
        "http_headers": headers,
        "no_warnings": True,
        "quiet": True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download(["${videoUrl}"])
    
    if os.path.exists("${outputPath}") and os.path.getsize("${outputPath}") > 0:
        print(f"SUCCESS: {os.path.getsize('${outputPath}')} bytes")
    else:
        print("ERROR: File not found or empty")
        sys.exit(1)
        
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
`;
            
            console.log(`🔧 Python yt-dlp script for: ${videoUrl} -> ${outputPath}`);
            
            const pythonProcess = spawn('python3', ['-c', pythonScript]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Python yt-dlp stdout: ${data.toString()}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Python yt-dlp stderr: ${data.toString()}`);
            });
            
            pythonProcess.on('close', (code) => {
                console.log(`🔚 Python yt-dlp process closed with code: ${code}`);
                if (code === 0 && stdout.includes('SUCCESS:')) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        const fileSize = fs.statSync(outputPath).size;
                        console.log(`✅ Python yt-dlp download successful: ${outputPath} (${fileSize} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-python-fallback',
                            fileSize: fileSize
                        });
                    } else {
                        console.error(`❌ Python yt-dlp file not found or empty: ${outputPath}`);
                        reject(new Error('Python yt-dlp download completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Python yt-dlp failed with code ${code}: ${stderr}`);
                    reject(new Error(`Python yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error(`❌ Python yt-dlp process error: ${error.message}`);
                reject(new Error(`Python yt-dlp process error: ${error.message}`));
            });
        });
    }
}

module.exports = new PoTokenController(); 