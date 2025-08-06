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
            
            // First try with OAuth token (if available)
            if (process.env.YOUTUBE_OAUTH_TOKEN) {
                console.log('🔐 Attempting download with OAuth token...');
                try {
                    const result = await this.downloadWithNodeYtDlp(videoUrl, outputPath);
                    return result;
                } catch (nodeError) {
                    console.error(`❌ Node.js yt-dlp with OAuth failed: ${nodeError.message}`);
                    
                    // Check if it's a 401 error (OAuth token expired/invalid)
                    if (nodeError.message.includes('401') || nodeError.message.includes('Unauthorized')) {
                        console.log('🔄 OAuth token appears to be expired/invalid, trying without OAuth...');
                        
                        // Try Python fallback without OAuth
                        try {
                            return await this.downloadWithPythonYtDlpNoOAuth(videoUrl, outputPath);
                        } catch (pythonError) {
                            console.error(`❌ Python yt-dlp without OAuth also failed: ${pythonError.message}`);
                            
                            // Try simple yt-dlp as final fallback
                            console.log('🔄 Trying simple yt-dlp with mobile user agent...');
                            try {
                                return await this.downloadWithSimpleYtDlp(videoUrl, outputPath);
                            } catch (simpleError) {
                                console.error(`❌ Simple yt-dlp also failed: ${simpleError.message}`);
                                
                                // Try alternative yt-dlp as final fallback
                                console.log('🔄 Trying alternative yt-dlp with TV client...');
                                try {
                                    return await this.downloadWithAlternativeYtDlp(videoUrl, outputPath);
                                } catch (alternativeError) {
                                    console.error(`❌ Alternative yt-dlp also failed: ${alternativeError.message}`);
                                    
                                    // Try basic yt-dlp as ultimate fallback
                                    console.log('🔄 Trying basic yt-dlp with minimal options...');
                                    try {
                                        return await this.downloadWithBasicYtDlp(videoUrl, outputPath);
                                    } catch (basicError) {
                                        console.error(`❌ Basic yt-dlp also failed: ${basicError.message}`);
                                        throw new Error(`All methods failed. OAuth: ${nodeError.message}, Python OAuth: ${pythonError.message}, Simple: ${simpleError.message}, Alternative: ${alternativeError.message}, Basic: ${basicError.message}`);
                                    }
                                }
                            }
                        }
                    } else {
                        // Non-OAuth related error, try Python fallback with OAuth
                        console.log('🔄 Trying Python yt-dlp fallback with OAuth...');
                        try {
                            return await this.downloadWithPythonYtDlp(videoUrl, outputPath);
                        } catch (pythonError) {
                            console.error(`❌ Python yt-dlp with OAuth also failed: ${pythonError.message}`);
                            
                            // Try simple yt-dlp as final fallback
                            console.log('🔄 Trying simple yt-dlp with mobile user agent...');
                            try {
                                return await this.downloadWithSimpleYtDlp(videoUrl, outputPath);
                            } catch (simpleError) {
                                console.error(`❌ Simple yt-dlp also failed: ${simpleError.message}`);
                                
                                // Try alternative yt-dlp as final fallback
                                console.log('🔄 Trying alternative yt-dlp with TV client...');
                                try {
                                    return await this.downloadWithAlternativeYtDlp(videoUrl, outputPath);
                                } catch (alternativeError) {
                                    console.error(`❌ Alternative yt-dlp also failed: ${alternativeError.message}`);
                                    throw new Error(`All methods failed. OAuth: ${nodeError.message}, Python OAuth: ${pythonError.message}, Simple: ${simpleError.message}, Alternative: ${alternativeError.message}`);
                                }
                            }
                        }
                    }
                }
            } else {
                // No OAuth token available, try without OAuth
                console.log('⚠️ No OAuth token available, trying without OAuth...');
                try {
                    return await this.downloadWithNodeYtDlpNoOAuth(videoUrl, outputPath);
                } catch (nodeError) {
                    console.error(`❌ Node.js yt-dlp without OAuth failed: ${nodeError.message}`);
                    
                    // Fallback to Python yt-dlp without OAuth
                    console.log('🔄 Trying Python yt-dlp fallback without OAuth...');
                    try {
                        return await this.downloadWithPythonYtDlpNoOAuth(videoUrl, outputPath);
                    } catch (pythonError) {
                        console.error(`❌ Python yt-dlp without OAuth also failed: ${pythonError.message}`);
                        
                        // Try simple yt-dlp as final fallback
                        console.log('🔄 Trying simple yt-dlp with mobile user agent...');
                        try {
                            return await this.downloadWithSimpleYtDlp(videoUrl, outputPath);
                        } catch (simpleError) {
                            console.error(`❌ Simple yt-dlp also failed: ${simpleError.message}`);
                            
                            // Try alternative yt-dlp as final fallback
                            console.log('🔄 Trying alternative yt-dlp with TV client...');
                            try {
                                return await this.downloadWithAlternativeYtDlp(videoUrl, outputPath);
                            } catch (alternativeError) {
                                console.error(`❌ Alternative yt-dlp also failed: ${alternativeError.message}`);
                                
                                // Try basic yt-dlp as ultimate fallback
                                console.log('🔄 Trying basic yt-dlp with minimal options...');
                                try {
                                    return await this.downloadWithBasicYtDlp(videoUrl, outputPath);
                                } catch (basicError) {
                                    console.error(`❌ Basic yt-dlp also failed: ${basicError.message}`);
                                    throw new Error(`All methods failed. Node: ${nodeError.message}, Python: ${pythonError.message}, Simple: ${simpleError.message}, Alternative: ${alternativeError.message}, Basic: ${basicError.message}`);
                                }
                            }
                        }
                    }
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
            
            // Enhanced yt-dlp download command with OAuth 2.0 and bot detection bypass
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
                // OAuth 2.0 authentication via headers (if available)
                ...(process.env.YOUTUBE_OAUTH_TOKEN ? [`--add-header`, `Authorization: Bearer ${process.env.YOUTUBE_OAUTH_TOKEN}`] : []),
                // Bot detection bypass options
                '--extractor-args', 'youtube:player_client=android',
                '--extractor-args', 'youtube:player_skip=webpage',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US"}',
                // Additional bypass options
                '--extractor-args', 'youtube:player_client=web',
                '--extractor-args', 'youtube:skip=hls,dash',
                '--extractor-args', 'youtube:player_skip=webpage,configs',
                // Enhanced bypass for OAuth
                '--extractor-args', 'youtube:player_client=web,android',
                '--extractor-args', 'youtube:player_skip=webpage,configs,js',
                '--extractor-args', 'youtube:player_params={"hl":"en","gl":"US","client":"web"}',
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
}

module.exports = new PoTokenController(); 