const { exec } = require('child_process');
const fs = require('fs');

class PoTokenController {
    constructor() {
        console.log('🎯 PoToken Controller initialized (VM-only mode)');
    }

    async checkYtDlpAvailability() {
        return new Promise((resolve) => {
            exec('which yt-dlp', (error) => {
                if (error) {
                    console.log('⚠️ yt-dlp not found, installing...');
                    this.installYtDlp().then(() => resolve(true)).catch(() => resolve(false));
                } else {
                    console.log('✅ yt-dlp found');
                    resolve(true);
                }
            });
        });
    }

    async installYtDlp() {
        return new Promise((resolve, reject) => {
            console.log('📥 Installing yt-dlp...');
            
            // Try apt-get first
            exec('apt-get update && apt-get install -y yt-dlp', (error, stdout, stderr) => {
                if (error) {
                    console.log('❌ Failed to install yt-dlp via apt-get:', error.message);
                    console.log('📥 Install stderr:', stderr);
                    console.log('🔄 Trying pip with --break-system-packages...');
                    
                    // Try pip as fallback
                    exec('pip install --break-system-packages yt-dlp', (pipError, pipStdout, pipStderr) => {
                        if (pipError) {
                            console.error('❌ Failed to install yt-dlp via pip:', pipError.message);
                            reject(pipError);
                        } else {
                            console.log('✅ yt-dlp installed successfully via pip');
                            console.log('📤 Install output:', pipStdout);
                            resolve();
                        }
                    });
                } else {
                    console.log('✅ yt-dlp installed successfully via apt-get');
                    resolve();
                }
            });
        });
    }

    async generatePoToken(videoUrl) {
        try {
            console.log(`🎯 Generating PoToken for: ${videoUrl}`);
            return await this.getVideoInfoWithPoToken(videoUrl);
        } catch (error) {
            console.error(`❌ PoToken generation failed: ${error.message}`);
            throw error;
        }
    }

    async runYtDlpWithEnhancedHeaders(videoUrl) {
        try {
            console.log(`🔧 Running yt-dlp with enhanced headers: ${videoUrl}`);
            return await this.downloadWithPoToken(videoUrl, `temp_${Date.now()}.mp4`);
        } catch (error) {
            console.error(`❌ Enhanced headers download failed: ${error.message}`);
            throw error;
        }
    }

    async getVideoInfoWithPoToken(videoUrl) {
        try {
            console.log(`📋 Getting video info with PoToken: ${videoUrl}`);
            return await this.runYtDlpWithEnhancedHeaders(videoUrl);
        } catch (error) {
            console.error(`❌ Video info extraction failed: ${error.message}`);
            throw error;
        }
    }

    async downloadWithPoToken(videoUrl, outputPath) {
        const timeout = 300000; // 5 minutes
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`PoToken download timed out after ${timeout/1000} seconds`));
            }, timeout);
        });

        try {
            console.log(`📥 Starting VM-only download: ${videoUrl}`);
            
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
                            reject(new Error(`VM download failed: ${downloadError.message}`));
                            return;
                        }
                        
                        console.log(`✅ VM download successful: ${vmFileName}`);
                        
                        // Step 2: Copy file from VM to local
                        console.log(`📋 Step 2: Copying file from VM to local...`);
                        const copyCommand = `gcloud compute scp ${vmUser}@${vmName}:/home/abhis/youtube-downloader/${vmFileName} ${outputPath} --zone=${vmZone}`;
                        
                        exec(copyCommand, { timeout: 60000 }, (copyError, copyStdout, copyStderr) => {
                            if (copyError) {
                                console.error(`❌ File copy failed: ${copyError.message}`);
                                reject(new Error(`File copy failed: ${copyError.message}`));
                                return;
                            }
                            
                            console.log(`✅ File copy successful: ${outputPath}`);
                            
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