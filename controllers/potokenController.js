const axios = require('axios');
const { spawn, exec } = require('child_process');
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
            const os = require('os');
            const platform = os.platform();
            
            // Check if we're on Windows
            if (platform === 'win32') {
                console.log('🪟 Windows detected - skipping local yt-dlp installation');
                console.log('🌐 Will use GCP VM for all YouTube downloads');
                this.isYtDlpAvailable = false; // Force VM usage on Windows
                return;
            }
            
            // For Linux/Mac, try to install yt-dlp if it doesn't exist
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
        const os = require('os');
        const platform = os.platform();
        
        // On Windows, always use VM approach
        if (platform === 'win32') {
            console.log(`🪟 Windows detected - using GCP VM for video processing: ${videoUrl}`);
            try {
                // Use VM approach for video info extraction
                const result = await this.runYtDlpWithEnhancedHeaders(videoUrl);
                return result;
            } catch (error) {
                console.error('❌ VM video processing failed:', error);
                throw error;
            }
        }
        
        // On Linux/Mac, check yt-dlp availability
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
        const os = require('os');
        const platform = os.platform();
        
        // On Windows, use VM for video info extraction
        if (platform === 'win32') {
            console.log(`🪟 Windows detected - using VM for video info extraction: ${videoUrl}`);
            try {
                const { exec } = require('child_process');
                
                // Get VM configuration
                const vmName = process.env.GCP_VM_NAME || 'youtube-downloader-vm';
                const vmZone = process.env.GCP_VM_ZONE || 'us-central1-a';
                const vmUser = process.env.GCP_VM_USER || 'abhis';
                
                // Run yt-dlp on VM to get video info
                const command = `gcloud compute ssh ${vmUser}@${vmName} --zone=${vmZone} --command="cd ~/youtube-downloader && /home/abhis/.local/bin/yt-dlp --dump-json --no-warnings ${videoUrl}"`;
                
                return new Promise((resolve, reject) => {
                    exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
                        if (error) {
                            reject(new Error(`VM yt-dlp failed: ${error.message}`));
                            return;
                        }
                        
                        if (stdout) {
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
                                reject(new Error(`Failed to parse VM yt-dlp output: ${parseError.message}`));
                            }
                        } else {
                            reject(new Error(`VM yt-dlp returned no output: ${stderr}`));
                        }
                    });
                });
            } catch (error) {
                throw new Error(`VM video info extraction failed: ${error.message}`);
            }
        }
        
        // On Linux/Mac, use local yt-dlp
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Enhanced yt-dlp command with anti-bot headers
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
            // Direct video info extraction without calling generatePoToken
            const result = await this.runYtDlpWithEnhancedHeaders(videoUrl);
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
        // Add timeout wrapper to prevent infinite loops
        const timeout = 300000; // 5 minutes
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`PoToken download timed out after ${timeout/1000} seconds`));
            }, timeout);
        });

        try {
            console.log(`📥 Starting download with VM-first approach: ${videoUrl}`);
            
            // Race between the download and timeout
            return await Promise.race([
                this._downloadWithPoTokenInternal(videoUrl, outputPath),
                timeoutPromise
            ]);
        } catch (error) {
            console.error(`❌ PoToken download error: ${error.message}`);
            throw error;
        }
    }

    async _downloadWithPoTokenInternal(videoUrl, outputPath) {
        try {
            console.log(`📥 Starting VM-only download approach: ${videoUrl}`);
            
            // VM-ONLY APPROACH: Only use GCP VM, no fallbacks
            console.log('🌐 Attempting download with GCP VM (VM-only mode)...');
            
            // Check if VM environment variables are configured
            const vmProjectId = process.env.GCP_PROJECT_ID;
            const vmName = process.env.GCP_VM_NAME;
            const vmZone = process.env.GCP_VM_ZONE;
            const vmUser = process.env.GCP_VM_USER;
            
            if (!vmProjectId || !vmName || !vmZone || !vmUser) {
                throw new Error('VM environment variables not configured. Please set GCP_PROJECT_ID, GCP_VM_NAME, GCP_VM_ZONE, and GCP_VM_USER in Render dashboard.');
            }
            
            console.log(`🔧 VM Configuration: ${vmName} in ${vmZone} (${vmProjectId})`);
            
            // Try VM download
            try {
                const result = await this.downloadWithGCPVM(videoUrl, outputPath);
                console.log('✅ VM download successful!');
                return result;
            } catch (vmError) {
                console.error(`❌ VM download failed: ${vmError.message}`);
                
                // If VM fails, provide clear error message
                if (vmError.message.includes('gcloud not available')) {
                    throw new Error('VM approach requires gcloud CLI. Please install gcloud on the server or use a different deployment method.');
                } else if (vmError.message.includes('VM health check failed')) {
                    throw new Error('VM is not accessible. Please check VM status and network connectivity.');
                } else {
                    throw new Error(`VM download failed: ${vmError.message}. This is the only available method in VM-only mode.`);
                }
            }
        } catch (error) {
            console.error(`❌ VM-only download failed: ${error.message}`);
            throw error;
        }
    }

    async downloadWithNodeYtDlp(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Enhanced yt-dlp download command with OAuth 2.0 and advanced bot detection bypass
            const ytDlpArgs = [
                '--output', outputPath,
                '--format', 'best[ext=mp4]/best',
                '--no-warnings',
                '--no-check-certificate',
                // Advanced user agent rotation
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // Enhanced headers for bot detection bypass
                '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                '--add-header', 'Accept-Language: en-US,en;q=0.9',
                '--add-header', 'Accept-Encoding: gzip, deflate, br',
                '--add-header', 'DNT: 1',
                '--add-header', 'Connection: keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests: 1',
                '--add-header', 'Sec-Fetch-Dest: document',
                '--add-header', 'Sec-Fetch-Mode: navigate',
                '--add-header', 'Sec-Fetch-Site: none',
                '--add-header', 'Sec-Fetch-User: ?1',
                '--add-header', 'Cache-Control: max-age=0',
                '--add-header', 'Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                '--add-header', 'Sec-Ch-Ua-Mobile: ?0',
                '--add-header', 'Sec-Ch-Ua-Platform: "Windows"',
                '--add-header', 'Sec-Ch-Ua-Platform-Version: "15.0.0"',
                '--add-header', 'Sec-Ch-Ua-Model: ""',
                '--add-header', 'Sec-Ch-Ua-Bitness: "64"',
                '--add-header', 'Sec-Ch-Ua-WoW64: ?0',
                '--add-header', 'Sec-Ch-Ua-Full-Version: "120.0.6099.109"',
                '--add-header', 'Sec-Ch-Ua-Full-Version-List: "Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.109", "Google Chrome";v="120.0.6099.109"',
                '--add-header', 'Sec-Ch-Ua-Arch: "x86"',
                // OAuth 2.0 authentication via headers (if available)
                ...(process.env.YOUTUBE_OAUTH_TOKEN ? [`--add-header`, `Authorization: Bearer ${process.env.YOUTUBE_OAUTH_TOKEN}`] : []),
                // Advanced bot detection bypass options
                '--extractor-args', 'youtube:player_client=android',
                '--extractor-args', 'youtube:player_skip=webpage',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US"}',
                '--extractor-args', 'youtube:player_client=web',
                '--extractor-args', 'youtube:skip=hls,dash',
                '--extractor-args', 'youtube:player_skip=webpage,configs',
                '--extractor-args', 'youtube:player_client=web,android',
                '--extractor-args', 'youtube:player_skip=webpage,configs,js',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"web"}',
                // Additional advanced bypass techniques
                '--extractor-args', 'youtube:player_client=web,android,tv',
                '--extractor-args', 'youtube:player_skip=webpage,configs,js,player',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"web","platform":"web"}',
                '--extractor-args', 'youtube:skip=hls,dash,webpage',
                '--extractor-args', 'youtube:player_client=web,android,tv,mobile',
                '--extractor-args', 'youtube:player_skip=webpage,configs,js,player,api',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"web","platform":"web","device":"desktop"}',
                // Rate limiting and delays
                '--sleep-interval', '2',
                '--max-sleep-interval', '5',
                '--retries', '3',
                '--fragment-retries', '3',
                '--file-access-retries', '3',
                '--extractor-retries', '3',
                videoUrl
            ];
            
            console.log(`🔧 Node.js yt-dlp command: yt-dlp ${ytDlpArgs.join(' ')}`);
            console.log('🔐 OAuth token available:', !!process.env.YOUTUBE_OAUTH_TOKEN);
            if (process.env.YOUTUBE_OAUTH_TOKEN) {
                console.log('🔐 OAuth token preview:', process.env.YOUTUBE_OAUTH_TOKEN.substring(0, 20) + '...');
            }
            
            // Try multiple yt-dlp paths
            let ytDlpPath = null;
            const possiblePaths = [
                './yt-dlp',
                'yt-dlp',
                'python3 -m yt_dlp',
                'python -m yt_dlp',
                '~/.local/bin/yt-dlp'
            ];
            
            for (const path of possiblePaths) {
                try {
                    if (path.includes('python')) {
                        // For Python module paths, test differently
                        const testProcess = spawn('python3', ['-c', 'import yt_dlp; print("OK")']);
                        testProcess.on('close', (code) => {
                            if (code === 0) {
                                ytDlpPath = path;
                                console.log(`✅ Found yt-dlp at: ${path}`);
                            }
                        });
                    } else if (fs.existsSync(path)) {
                        ytDlpPath = path;
                        console.log(`✅ Found yt-dlp at: ${path}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Path not found: ${path}`);
                }
            }
            
            if (!ytDlpPath) {
                // Fallback to python module
                ytDlpPath = 'python3 -m yt_dlp';
                console.log(`🔧 Using fallback yt-dlp path: ${ytDlpPath}`);
            }
            
            // Split command for python module
            const [command, ...args] = ytDlpPath.split(' ');
            const finalArgs = [...args, ...ytDlpArgs];
            
            console.log(`🔧 Final command: ${command} ${finalArgs.join(' ')}`);
            
            const ytDlpProcess = spawn(command, finalArgs);
            
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
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                ytDlpProcess.kill();
                reject(new Error('yt-dlp process timed out after 60 seconds'));
            }, 60000);
            
            ytDlpProcess.on('close', (code) => {
                clearTimeout(timeout);
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
            
            // Python script to download with yt-dlp, OAuth 2.0, and bot detection bypass
            const pythonScript = `
import yt_dlp
import sys
import os

try:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    # Get OAuth token from environment
    oauth_token = os.getenv('YOUTUBE_OAUTH_TOKEN')
    if oauth_token:
        headers["Authorization"] = f"Bearer {oauth_token}"
        print(f"Using OAuth token: {oauth_token[:20]}...")
    else:
        print("No OAuth token found in environment")
    
    ydl_opts = {
        "outtmpl": "${outputPath}",
        "format": "best[ext=mp4]/best",
        "http_headers": headers,
        "no_warnings": True,
        "quiet": True,
        # OAuth 2.0 authentication (if available)
        ${process.env.YOUTUBE_OAUTH_TOKEN ? `"access_token": "${process.env.YOUTUBE_OAUTH_TOKEN}",` : ''}
        # Bot detection bypass options
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web"],
                "player_skip": ["webpage", "configs", "js"],
                "player_params": {"hl": "en", "gl": "US", "client": "web"},
                "skip": ["hls", "dash"]
            }
        }
    }
    
    print(f"yt-dlp options: {ydl_opts}")
    
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
            
            // Add timeout to prevent hanging
            const pythonTimeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Python yt-dlp process timed out after 60 seconds'));
            }, 60000);
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Python yt-dlp stdout: ${data.toString()}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Python yt-dlp stderr: ${data.toString()}`);
            });
            
            pythonProcess.on('close', (code) => {
                clearTimeout(pythonTimeout);
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

    async downloadWithNodeYtDlpNoOAuth(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Enhanced yt-dlp download command WITHOUT OAuth 2.0, using advanced bot detection bypass
            const ytDlpArgs = [
                '--output', outputPath,
                '--format', 'best[ext=mp4]/best',
                '--no-warnings',
                '--no-check-certificate',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
                '--add-header', 'Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                '--add-header', 'Sec-Ch-Ua-Mobile: ?0',
                '--add-header', 'Sec-Ch-Ua-Platform: "Windows"',
                // Advanced bot detection bypass options
                '--extractor-args', 'youtube:player_client=web',
                '--extractor-args', 'youtube:player_skip=webpage,configs,js',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"web"}',
                '--extractor-args', 'youtube:skip=hls,dash',
                // Additional bypass techniques
                '--extractor-args', 'youtube:player_client=android',
                '--extractor-args', 'youtube:player_skip=webpage,configs',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"android"}',
                // Rate limiting and delays
                '--sleep-interval', '2',
                '--max-sleep-interval', '5',
                '--retries', '3',
                videoUrl
            ];
            
            console.log(`🔧 Node.js yt-dlp command (no OAuth, enhanced bypass): yt-dlp ${ytDlpArgs.join(' ')}`);
            console.log('🔐 OAuth token: DISABLED for this attempt');
            console.log('🛡️ Using enhanced bot detection bypass techniques');
            
            // Try multiple yt-dlp paths
            let ytDlpPath = null;
            const possiblePaths = [
                './yt-dlp',
                'yt-dlp',
                'python3 -m yt_dlp',
                'python -m yt_dlp',
                '~/.local/bin/yt-dlp'
            ];
            
            for (const path of possiblePaths) {
                try {
                    if (path.includes('python')) {
                        // For Python module paths, test differently
                        const testProcess = spawn('python3', ['-c', 'import yt_dlp; print("OK")']);
                        testProcess.on('close', (code) => {
                            if (code === 0) {
                                ytDlpPath = path;
                                console.log(`✅ Found yt-dlp at: ${path}`);
                            }
                        });
                    } else if (fs.existsSync(path)) {
                        ytDlpPath = path;
                        console.log(`✅ Found yt-dlp at: ${path}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Path not found: ${path}`);
                }
            }
            
            if (!ytDlpPath) {
                // Fallback to python module
                ytDlpPath = 'python3 -m yt_dlp';
                console.log(`🔧 Using fallback yt-dlp path: ${ytDlpPath}`);
            }
            
            // Split command for python module
            const [command, ...args] = ytDlpPath.split(' ');
            const finalArgs = [...args, ...ytDlpArgs];
            
            console.log(`🔧 Final command (no OAuth, enhanced): ${command} ${finalArgs.join(' ')}`);
            
            const ytDlpProcess = spawn(command, finalArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Node.js yt-dlp stdout (no OAuth): ${data.toString()}`);
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Node.js yt-dlp stderr (no OAuth): ${data.toString()}`);
            });
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                ytDlpProcess.kill();
                reject(new Error('yt-dlp process timed out after 120 seconds'));
            }, 120000); // Increased timeout for enhanced bypass
            
            ytDlpProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`🔚 Node.js yt-dlp process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Node.js yt-dlp download successful (no OAuth): ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-node-no-oauth-enhanced',
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

    async downloadWithPythonYtDlpNoOAuth(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Python script to download with yt-dlp WITHOUT OAuth 2.0, using advanced bot detection bypass
            const pythonScript = `
import yt_dlp
import sys
import os
import time
import random

try:
    # Enhanced headers for better bot detection bypass
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"'
    }
    
    print("No OAuth token - using enhanced headers and bypass techniques")
    
    # Add random delay to avoid rate limiting
    time.sleep(random.uniform(1, 3))
    
    ydl_opts = {
        "outtmpl": "${outputPath}",
        "format": "best[ext=mp4]/best",
        "http_headers": headers,
        "no_warnings": True,
        "quiet": True,
        # Enhanced bot detection bypass options
        "extractor_args": {
            "youtube": {
                "player_client": ["web", "android"],
                "player_skip": ["webpage", "configs", "js"],
                "player_params": {"hl": "en", "gl": "US", "client": "web"},
                "skip": ["hls", "dash"]
            }
        },
        # Rate limiting and retry options
        "sleep_interval": 2,
        "max_sleep_interval": 5,
        "retries": 3,
        # Additional bypass techniques
        "nocheckcertificate": True,
        "ignoreerrors": False,
        "no_color": True
    }
    
    print(f"yt-dlp options (no OAuth, enhanced): {ydl_opts}")
    
    # Try multiple extraction methods
    success = False
    for attempt in range(3):
        try:
            print(f"Attempt {attempt + 1}/3...")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download(["${videoUrl}"])
            
            if os.path.exists("${outputPath}") and os.path.getsize("${outputPath}") > 0:
                print(f"SUCCESS: {os.path.getsize('${outputPath}')} bytes")
                success = True
                break
            else:
                print(f"Attempt {attempt + 1} failed: File not found or empty")
                if attempt < 2:
                    time.sleep(random.uniform(2, 5))
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt < 2:
                time.sleep(random.uniform(2, 5))
    
    if not success:
        print("ERROR: All attempts failed")
        sys.exit(1)
        
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
`;
            
            console.log(`🔧 Python yt-dlp script (no OAuth, enhanced): ${videoUrl} -> ${outputPath}`);
            
            const pythonProcess = spawn('python3', ['-c', pythonScript]);
            
            let stdout = '';
            let stderr = '';
            
            // Add timeout to prevent hanging
            const pythonTimeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Python yt-dlp process timed out after 120 seconds'));
            }, 120000); // Increased timeout for enhanced bypass
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Python yt-dlp stdout (no OAuth): ${data.toString()}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Python yt-dlp stderr (no OAuth): ${data.toString()}`);
            });
            
            pythonProcess.on('close', (code) => {
                clearTimeout(pythonTimeout);
                console.log(`🔚 Python yt-dlp process closed with code: ${code}`);
                if (code === 0 && stdout.includes('SUCCESS:')) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        const fileSize = fs.statSync(outputPath).size;
                        console.log(`✅ Python yt-dlp download successful (no OAuth, enhanced): ${outputPath} (${fileSize} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-python-no-oauth-enhanced',
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

    async downloadWithSimpleYtDlp(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Simple yt-dlp download command with mobile user agent and minimal options
            const ytDlpArgs = [
                '--output', outputPath,
                '--format', 'best',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                '--add-header', 'Accept-Language: en-US,en;q=0.5',
                '--add-header', 'Accept-Encoding: gzip, deflate',
                '--add-header', 'Connection: keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests: 1',
                // Minimal extraction args
                '--extractor-args', 'youtube:player_client=mobile',
                '--extractor-args', 'youtube:player_skip=webpage',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US"}',
                // Rate limiting
                '--sleep-interval', '3',
                '--max-sleep-interval', '7',
                '--retries', '5',
                videoUrl
            ];
            
            console.log(`🔧 Simple yt-dlp command (mobile user agent): yt-dlp ${ytDlpArgs.join(' ')}`);
            console.log('📱 Using mobile user agent and minimal extraction');
            
            // Try multiple yt-dlp paths
            let ytDlpPath = null;
            const possiblePaths = [
                './yt-dlp',
                'yt-dlp',
                'python3 -m yt_dlp',
                'python -m yt_dlp',
                '~/.local/bin/yt-dlp'
            ];
            
            for (const path of possiblePaths) {
                try {
                    if (path.includes('python')) {
                        // For Python module paths, test differently
                        const testProcess = spawn('python3', ['-c', 'import yt_dlp; print("OK")']);
                        testProcess.on('close', (code) => {
                            if (code === 0) {
                                ytDlpPath = path;
                                console.log(`✅ Found yt-dlp at: ${path}`);
                            }
                        });
                    } else if (fs.existsSync(path)) {
                        ytDlpPath = path;
                        console.log(`✅ Found yt-dlp at: ${path}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Path not found: ${path}`);
                }
            }
            
            if (!ytDlpPath) {
                // Fallback to python module
                ytDlpPath = 'python3 -m yt_dlp';
                console.log(`🔧 Using fallback yt-dlp path: ${ytDlpPath}`);
            }
            
            // Split command for python module
            const [command, ...args] = ytDlpPath.split(' ');
            const finalArgs = [...args, ...ytDlpArgs];
            
            console.log(`🔧 Final command (simple): ${command} ${finalArgs.join(' ')}`);
            
            const ytDlpProcess = spawn(command, finalArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Simple yt-dlp stdout: ${data.toString()}`);
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Simple yt-dlp stderr: ${data.toString()}`);
            });
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                ytDlpProcess.kill();
                reject(new Error('Simple yt-dlp process timed out after 180 seconds'));
            }, 180000); // Longer timeout for simple method
            
            ytDlpProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`🔚 Simple yt-dlp process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Simple yt-dlp download successful: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-simple-mobile',
                            fileSize: fs.statSync(outputPath).size
                        });
                    } else {
                        console.error(`❌ Simple yt-dlp file not found or empty: ${outputPath}`);
                        reject(new Error('Simple yt-dlp download completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Simple yt-dlp failed with code ${code}: ${stderr}`);
                    reject(new Error(`Simple yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            ytDlpProcess.on('error', (error) => {
                console.error(`❌ Simple yt-dlp process error: ${error.message}`);
                reject(new Error(`Simple yt-dlp process error: ${error.message}`));
            });
        });
    }

    async downloadWithAlternativeYtDlp(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Alternative yt-dlp download command with different approach
            const ytDlpArgs = [
                '--output', outputPath,
                '--format', 'worst[ext=mp4]/worst',  // Try worst quality first
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                '--add-header', 'Accept-Language: en-US,en;q=0.5',
                '--add-header', 'Accept-Encoding: gzip, deflate',
                '--add-header', 'Connection: keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests: 1',
                // Different extraction approach
                '--extractor-args', 'youtube:player_client=tv',
                '--extractor-args', 'youtube:player_skip=webpage,configs,js',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"tv"}',
                // Alternative format selection
                '--format-sort', 'res:240,fps:30,codec:h264',
                // Rate limiting
                '--sleep-interval', '5',
                '--max-sleep-interval', '10',
                '--retries', '10',
                videoUrl
            ];
            
            console.log(`🔧 Alternative yt-dlp command (TV client): yt-dlp ${ytDlpArgs.join(' ')}`);
            console.log('📺 Using TV client and alternative format selection');
            
            // Try multiple yt-dlp paths
            let ytDlpPath = null;
            const possiblePaths = [
                './yt-dlp',
                'yt-dlp',
                'python3 -m yt_dlp',
                'python -m yt_dlp',
                '~/.local/bin/yt-dlp'
            ];
            
            for (const path of possiblePaths) {
                try {
                    if (path.includes('python')) {
                        // For Python module paths, test differently
                        const testProcess = spawn('python3', ['-c', 'import yt_dlp; print("OK")']);
                        testProcess.on('close', (code) => {
                            if (code === 0) {
                                ytDlpPath = path;
                                console.log(`✅ Found yt-dlp at: ${path}`);
                            }
                        });
                    } else if (fs.existsSync(path)) {
                        ytDlpPath = path;
                        console.log(`✅ Found yt-dlp at: ${path}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Path not found: ${path}`);
                }
            }
            
            if (!ytDlpPath) {
                // Fallback to python module
                ytDlpPath = 'python3 -m yt_dlp';
                console.log(`🔧 Using fallback yt-dlp path: ${ytDlpPath}`);
            }
            
            // Split command for python module
            const [command, ...args] = ytDlpPath.split(' ');
            const finalArgs = [...args, ...ytDlpArgs];
            
            console.log(`🔧 Final command (alternative): ${command} ${finalArgs.join(' ')}`);
            
            const ytDlpProcess = spawn(command, finalArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Alternative yt-dlp stdout: ${data.toString()}`);
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Alternative yt-dlp stderr: ${data.toString()}`);
            });
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                ytDlpProcess.kill();
                reject(new Error('Alternative yt-dlp process timed out after 240 seconds'));
            }, 240000); // Longer timeout for alternative method
            
            ytDlpProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`🔚 Alternative yt-dlp process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Alternative yt-dlp download successful: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-alternative-tv',
                            fileSize: fs.statSync(outputPath).size
                        });
                    } else {
                        console.error(`❌ Alternative yt-dlp file not found or empty: ${outputPath}`);
                        reject(new Error('Alternative yt-dlp download completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Alternative yt-dlp failed with code ${code}: ${stderr}`);
                    reject(new Error(`Alternative yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            ytDlpProcess.on('error', (error) => {
                console.error(`❌ Alternative yt-dlp process error: ${error.message}`);
                reject(new Error(`Alternative yt-dlp process error: ${error.message}`));
            });
        });
    }

    async downloadWithBasicYtDlp(videoUrl, outputPath) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Basic yt-dlp download command with minimal options
            const ytDlpArgs = [
                '--output', outputPath,
                '--format', 'worst',  // Get the worst quality available
                '--no-warnings',
                '--quiet',
                '--no-check-certificate',
                '--no-cookies-from-browser',
                '--no-cookies',
                '--extract-audio',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                videoUrl
            ];
            
            console.log(`🔧 Basic yt-dlp command (minimal options): yt-dlp ${ytDlpArgs.join(' ')}`);
            console.log('🔧 Using most basic yt-dlp approach possible');
            
            // Try multiple yt-dlp paths
            let ytDlpPath = null;
            const possiblePaths = [
                './yt-dlp',
                'yt-dlp',
                'python3 -m yt_dlp',
                'python -m yt_dlp',
                '~/.local/bin/yt-dlp'
            ];
            
            for (const path of possiblePaths) {
                try {
                    if (path.includes('python')) {
                        // For Python module paths, test differently
                        const testProcess = spawn('python3', ['-c', 'import yt_dlp; print("OK")']);
                        testProcess.on('close', (code) => {
                            if (code === 0) {
                                ytDlpPath = path;
                                console.log(`✅ Found yt-dlp at: ${path}`);
                            }
                        });
                    } else if (fs.existsSync(path)) {
                        ytDlpPath = path;
                        console.log(`✅ Found yt-dlp at: ${path}`);
                        break;
                    }
                } catch (e) {
                    console.log(`❌ Path not found: ${path}`);
                }
            }
            
            if (!ytDlpPath) {
                // Fallback to python module
                ytDlpPath = 'python3 -m yt_dlp';
                console.log(`🔧 Using fallback yt-dlp path: ${ytDlpPath}`);
            }
            
            // Split command for python module
            const [command, ...args] = ytDlpPath.split(' ');
            const finalArgs = [...args, ...ytDlpArgs];
            
            console.log(`🔧 Final command (basic): ${command} ${finalArgs.join(' ')}`);
            
            const ytDlpProcess = spawn(command, finalArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Basic yt-dlp stdout: ${data.toString()}`);
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Basic yt-dlp stderr: ${data.toString()}`);
            });
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                ytDlpProcess.kill();
                reject(new Error('Basic yt-dlp process timed out after 300 seconds'));
            }, 300000); // Longer timeout for basic method
            
            ytDlpProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`🔚 Basic yt-dlp process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Basic yt-dlp download successful: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'yt-dlp-basic-minimal',
                            fileSize: fs.statSync(outputPath).size
                        });
                    } else {
                        console.error(`❌ Basic yt-dlp file not found or empty: ${outputPath}`);
                        reject(new Error('Basic yt-dlp download completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Basic yt-dlp failed with code ${code}: ${stderr}`);
                    reject(new Error(`Basic yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            ytDlpProcess.on('error', (error) => {
                console.error(`❌ Basic yt-dlp process error: ${error.message}`);
                reject(new Error(`Basic yt-dlp process error: ${error.message}`));
            });
        });
    }

    async downloadWithDirectExtraction(videoUrl, outputPath) {
        return new Promise(async (resolve, reject) => {
            const { spawn } = require('child_process');
            const fs = require('fs');
            
            console.log(`🔧 Direct extraction method: ${videoUrl} -> ${outputPath}`);
            console.log('🔧 Using direct HTTP requests to extract video URLs (built-in modules only)');
            
            // Python script for direct video URL extraction without yt-dlp (built-in modules only)
            const pythonScript = `
import urllib.request
import urllib.parse
import re
import json
import sys
import os
import subprocess
from urllib.parse import urlparse, parse_qs

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\\.com/watch\\?v=|youtu\\.be/|youtube\\.com/embed/)([^&?/]+)',
        r'youtube\\.com/watch\\?.*v=([^&]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def get_video_info(video_id):
    """Get video info using YouTube's public API (built-in urllib only)"""
    try:
        # Try to get video info from YouTube's public API
        url = f"https://www.youtube.com/get_video_info?video_id={video_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        # Create request with headers
        req = urllib.request.Request(url, headers=headers)
        
        # Make the request
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                data = response.read().decode('utf-8')
                # Parse the response
                parsed_data = parse_qs(data)
                if 'player_response' in parsed_data:
                    player_response = json.loads(parsed_data['player_response'][0])
                    return player_response
    except Exception as e:
        print(f"Error getting video info: {e}")
    
    return None

def extract_direct_urls(player_response):
    """Extract direct video URLs from player response"""
    urls = []
    
    try:
        if 'streamingData' in player_response:
            # Try progressive formats first
            if 'formats' in player_response['streamingData']:
                for fmt in player_response['streamingData']['formats']:
                    if 'url' in fmt:
                        urls.append({
                            'url': fmt['url'],
                            'quality': fmt.get('qualityLabel', 'unknown'),
                            'type': 'progressive'
                        })
            
            # Try adaptive formats
            if 'adaptiveFormats' in player_response['streamingData']:
                for fmt in player_response['streamingData']['adaptiveFormats']:
                    if 'url' in fmt:
                        urls.append({
                            'url': fmt['url'],
                            'quality': fmt.get('qualityLabel', 'unknown'),
                            'type': 'adaptive'
                        })
        
        # Also try videoDetails
        if 'videoDetails' in player_response:
            print(f"Video title: {player_response['videoDetails'].get('title', 'Unknown')}")
            
    except Exception as e:
        print(f"Error extracting URLs: {e}")
    
    return urls

def download_video(url, output_path):
    """Download video using curl/wget"""
    try:
        # Try curl first
        result = subprocess.run(['curl', '-L', '-o', output_path, url], 
                              capture_output=True, text=True, timeout=300)
        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
    except:
        pass
    
    try:
        # Try wget as fallback
        result = subprocess.run(['wget', '-O', output_path, url], 
                              capture_output=True, text=True, timeout=300)
        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
    except:
        pass
    
    return False

# Main execution
video_url = "${videoUrl}"
output_path = "${outputPath}"
video_id = extract_video_id(video_url)

if not video_id:
    print("ERROR: Could not extract video ID")
    sys.exit(1)

print(f"Extracted video ID: {video_id}")

# Get video info
player_response = get_video_info(video_id)
if not player_response:
    print("ERROR: Could not get video info")
    sys.exit(1)

# Extract direct URLs
urls = extract_direct_urls(player_response)
if not urls:
    print("ERROR: Could not extract video URLs")
    sys.exit(1)

print(f"Found {len(urls)} direct video URLs")

# Try to download with the first available URL
for i, url_info in enumerate(urls):
    print(f"Trying URL {i+1}/{len(urls)}: {url_info['quality']} ({url_info['type']})")
    
    if download_video(url_info['url'], output_path):
        print(f"SUCCESS: Downloaded {os.path.getsize(output_path)} bytes")
        sys.exit(0)
    else:
        print(f"Failed to download with URL {i+1}")

print("ERROR: All direct URLs failed")
sys.exit(1)
`;
            
            console.log(`🔧 Direct extraction script (built-in modules): ${videoUrl} -> ${outputPath}`);
            
            const pythonProcess = spawn('python3', ['-c', pythonScript]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Direct extraction stdout: ${data.toString()}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Direct extraction stderr: ${data.toString()}`);
            });
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Direct extraction process timed out after 300 seconds'));
            }, 300000);
            
            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`🔚 Direct extraction process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Direct extraction successful: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'direct-extraction-http-builtin',
                            fileSize: fs.statSync(outputPath).size
                        });
                    } else {
                        console.error(`❌ Direct extraction file not found or empty: ${outputPath}`);
                        reject(new Error('Direct extraction completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Direct extraction failed with code ${code}: ${stderr}`);
                    reject(new Error(`Direct extraction failed with code ${code}: ${stderr}`));
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error(`❌ Direct extraction process error: ${error.message}`);
                reject(new Error(`Direct extraction process error: ${error.message}`));
            });
        });
    }

    async downloadWithAlternativeSources(videoUrl, outputPath) {
        return new Promise(async (resolve, reject) => {
            const { spawn } = require('child_process');
            const fs = require('fs');
            
            console.log(`🔧 Alternative sources method: ${videoUrl} -> ${outputPath}`);
            console.log('🔧 Using alternative video sources and manual extraction techniques');
            
            // Python script for alternative video sources and manual extraction
            const pythonScript = `
import urllib.request
import urllib.parse
import re
import json
import sys
import os
import subprocess
import time
import random
from urllib.parse import urlparse, parse_qs

def extract_video_id(url):
    """Extract video ID from YouTube URL"""
    patterns = [
        r'(?:youtube\\.com/watch\\?v=|youtu\\.be/|youtube\\.com/embed/)([^&?/]+)',
        r'youtube\\.com/watch\\?.*v=([^&]+)'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def try_invidious_api(video_id):
    """Try to get video info from Invidious API"""
    invidious_instances = [
        'https://invidious.projectsegfau.lt',
        'https://invidious.slipfox.xyz',
        'https://invidious.prvcy.eu',
        'https://invidious.kavin.rocks',
        'https://invidious.weblibre.org'
    ]
    
    for instance in invidious_instances:
        try:
            url = f"{instance}/api/v1/videos/{video_id}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    if 'formatStreams' in data and data['formatStreams']:
                        return data['formatStreams']
        except Exception as e:
            print(f"Invidious {instance} failed: {e}")
            continue
    
    return None

def try_alternative_youtube_frontend(video_id):
    """Try alternative YouTube frontend"""
    try:
        # Try to get video info from alternative frontend
        url = f"https://pipedapi.kavin.rocks/streams/{video_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if 'videoStreams' in data and data['videoStreams']:
                    return data['videoStreams']
    except Exception as e:
        print(f"Alternative frontend failed: {e}")
    
    return None

def try_manual_extraction(video_id):
    """Try manual extraction from YouTube page"""
    try:
        # Try to get the video page and extract URLs manually
        url = f"https://www.youtube.com/watch?v={video_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            if response.status == 200:
                html = response.read().decode('utf-8')
                
                # Look for video URLs in the HTML
                patterns = [
                    r'"url":"([^"]*googlevideo[^"]*)"',
                    r'"url":"([^"]*videoplayback[^"]*)"',
                    r'https://[^"]*googlevideo[^"]*',
                    r'https://[^"]*videoplayback[^"]*'
                ]
                
                for pattern in patterns:
                    matches = re.findall(pattern, html)
                    if matches:
                        return [{'url': match, 'quality': 'unknown'} for match in matches]
    except Exception as e:
        print(f"Manual extraction failed: {e}")
    
    return None

def download_video(url, output_path):
    """Download video using curl/wget"""
    try:
        # Try curl first
        result = subprocess.run(['curl', '-L', '-o', output_path, url], 
                              capture_output=True, text=True, timeout=300)
        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
    except:
        pass
    
    try:
        # Try wget as fallback
        result = subprocess.run(['wget', '-O', output_path, url], 
                              capture_output=True, text=True, timeout=300)
        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return True
    except:
        pass
    
    return False

# Main execution
video_url = "${videoUrl}"
output_path = "${outputPath}"
video_id = extract_video_id(video_url)

if not video_id:
    print("ERROR: Could not extract video ID")
    sys.exit(1)

print(f"Extracted video ID: {video_id}")

# Try multiple alternative sources
sources = [
    ("Invidious API", lambda: try_invidious_api(video_id)),
    ("Alternative Frontend", lambda: try_alternative_youtube_frontend(video_id)),
    ("Manual Extraction", lambda: try_manual_extraction(video_id))
]

urls = []
for source_name, source_func in sources:
    print(f"Trying {source_name}...")
    try:
        result = source_func()
        if result:
            urls.extend(result)
            print(f"Found {len(result)} URLs from {source_name}")
            break
    except Exception as e:
        print(f"{source_name} failed: {e}")

if not urls:
    print("ERROR: Could not extract video URLs from any alternative source")
    sys.exit(1)

print(f"Found {len(urls)} total URLs")

# Try to download with the first available URL
for i, url_info in enumerate(urls):
    url = url_info['url'] if isinstance(url_info, dict) else url_info
    quality = url_info.get('quality', 'unknown') if isinstance(url_info, dict) else 'unknown'
    
    print(f"Trying URL {i+1}/{len(urls)}: {quality}")
    
    if download_video(url, output_path):
        print(f"SUCCESS: Downloaded {os.path.getsize(output_path)} bytes")
        sys.exit(0)
    else:
        print(f"Failed to download with URL {i+1}")

print("ERROR: All alternative URLs failed")
sys.exit(1)
`;
            
            console.log(`🔧 Alternative sources script: ${videoUrl} -> ${outputPath}`);
            
            const pythonProcess = spawn('python3', ['-c', pythonScript]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                console.log(`📤 Alternative sources stdout: ${data.toString()}`);
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                console.log(`📥 Alternative sources stderr: ${data.toString()}`);
            });
            
            // Add timeout to prevent hanging
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Alternative sources process timed out after 300 seconds'));
            }, 300000);
            
            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                console.log(`🔚 Alternative sources process closed with code: ${code}`);
                if (code === 0) {
                    // Check if file was actually downloaded
                    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                        console.log(`✅ Alternative sources successful: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
                        resolve({
                            success: true,
                            filePath: outputPath,
                            method: 'alternative-sources-multi',
                            fileSize: fs.statSync(outputPath).size
                        });
                    } else {
                        console.error(`❌ Alternative sources file not found or empty: ${outputPath}`);
                        reject(new Error('Alternative sources completed but file is empty or missing'));
                    }
                } else {
                    console.error(`❌ Alternative sources failed with code ${code}: ${stderr}`);
                    reject(new Error(`Alternative sources failed with code ${code}: ${stderr}`));
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error(`❌ Alternative sources process error: ${error.message}`);
                reject(new Error(`Alternative sources process error: ${error.message}`));
            });
        });
    }

    /**
     * Download video using Google Cloud VM approach
     * This method bypasses bot detection by using a clean VM environment
     */
    async downloadWithGCPVM(videoUrl, outputPath) {
        try {
            console.log(`🌐 Using GCP VM for download: ${videoUrl}`);
            
            // Check if gcloud is available first
            return new Promise((resolve, reject) => {
                exec('which gcloud', { timeout: 5000 }, (gcloudError) => {
                    if (gcloudError) {
                        console.log(`⚠️ gcloud not available on this system, cannot use VM approach`);
                        reject(new Error('gcloud not available on this system'));
                        return;
                    }
                    
                    // Get VM configuration from environment variables or use defaults
                    const vmName = process.env.GCP_VM_NAME || 'youtube-downloader-vm';
                    const vmZone = process.env.GCP_VM_ZONE || 'us-central1-a';
                    const vmUser = process.env.GCP_VM_USER || 'abhis';
                    
                    // Extract filename from outputPath
                    const path = require('path');
                    const fileName = path.basename(outputPath);
                    const vmFileName = `vm_${Date.now()}_${fileName}`;
                    
                    // Step 1: Download to VM
                    console.log(`📥 Step 1: Downloading to VM as ${vmFileName}...`);
                    const downloadCommand = `gcloud compute ssh ${vmUser}@${vmName} --zone=${vmZone} --command="cd ~/youtube-downloader && /home/abhis/.local/bin/yt-dlp --output ${vmFileName} ${videoUrl}"`;
                    
                    exec(downloadCommand, { timeout: 300000 }, (downloadError, downloadStdout, downloadStderr) => {
                        if (downloadError) {
                            console.error(`❌ VM download failed: ${downloadError.message}`);
                            console.error(`📥 VM stderr: ${downloadStderr}`);
                            reject(new Error(`VM download failed: ${downloadError.message}`));
                            return;
                        }
                        
                        console.log(`✅ VM download successful: ${vmFileName}`);
                        console.log(`📤 VM stdout: ${downloadStdout}`);
                        
                        // Step 2: Copy file from VM to local
                        console.log(`📋 Step 2: Copying file from VM to local...`);
                        const copyCommand = `gcloud compute scp ${vmUser}@${vmName}:/home/abhis/youtube-downloader/${vmFileName} ${outputPath} --zone=${vmZone}`;
                        
                        exec(copyCommand, { timeout: 60000 }, (copyError, copyStdout, copyStderr) => {
                            if (copyError) {
                                console.error(`❌ File copy failed: ${copyError.message}`);
                                console.error(`📥 Copy stderr: ${copyStderr}`);
                                reject(new Error(`File copy failed: ${copyError.message}`));
                                return;
                            }
                            
                            console.log(`✅ File copy successful: ${outputPath}`);
                            console.log(`📤 Copy stdout: ${copyStdout}`);
                            
                            // Step 3: Clean up file on VM
                            console.log(`🧹 Step 3: Cleaning up file on VM...`);
                            const cleanupCommand = `gcloud compute ssh ${vmUser}@${vmName} --zone=${vmZone} --command="cd ~/youtube-downloader && rm -f ${vmFileName}"`;
                            
                            exec(cleanupCommand, { timeout: 30000 }, (cleanupError) => {
                                if (cleanupError) {
                                    console.warn(`⚠️ Cleanup failed: ${cleanupError.message}`);
                                } else {
                                    console.log(`✅ Cleanup successful`);
                                }
                                
                                // Check if file was actually copied
                                if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                                    resolve({
                                        success: true,
                                        filePath: outputPath,
                                        method: 'gcp-vm',
                                        fileSize: fs.statSync(outputPath).size
                                    });
                                } else {
                                    console.error(`❌ File copy completed but file not found: ${outputPath}`);
                                    reject(new Error('File copy completed but file is missing or empty'));
                                }
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error(`❌ VM download error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check VM health and availability
     */
    async checkVMHealth() {
        try {
            // Check if gcloud is available first
            return new Promise((resolve) => {
                exec('which gcloud', { timeout: 5000 }, (gcloudError) => {
                    if (gcloudError) {
                        console.log(`⚠️ gcloud not available on this system, skipping VM health check`);
                        resolve({
                            success: true,
                            vmHealthy: false,
                            timestamp: new Date().toISOString(),
                            message: 'gcloud not available on this system'
                        });
                        return;
                    }
                    
                    // If gcloud is available, check VM health
                    const vmName = process.env.GCP_VM_NAME || 'youtube-downloader-vm';
                    const vmZone = process.env.GCP_VM_ZONE || 'us-central1-a';
                    const vmUser = process.env.GCP_VM_USER || 'abhis';
                    
                    const healthCheck = `gcloud compute ssh ${vmUser}@${vmName} --zone=${vmZone} --command="yt-dlp --version"`;
                    
                    exec(healthCheck, { timeout: 30000 }, (error) => {
                        if (error) {
                            console.error(`❌ VM health check failed: ${error.message}`);
                            resolve({
                                success: true,
                                vmHealthy: false,
                                timestamp: new Date().toISOString(),
                                message: 'VM health check failed'
                            });
                        } else {
                            console.log(`✅ VM health check passed`);
                            resolve({
                                success: true,
                                vmHealthy: true,
                                timestamp: new Date().toISOString(),
                                message: 'VM is healthy'
                            });
                        }
                    });
                });
            });
        } catch (error) {
            console.error(`❌ VM health check error: ${error.message}`);
            return {
                success: false,
                vmHealthy: false,
                timestamp: new Date().toISOString(),
                message: error.message
            };
        }
    }
}

module.exports = new PoTokenController(); 