'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [volume, setVolume] = useState<number | null>(null);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [audience, setAudience] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [requiredVolume, setRequiredVolume] = useState<number>(0);
  const [maxVolume, setMaxVolume] = useState<number>(-Infinity);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // クリーンアップ関数
  const stopRecording = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsRecording(false);
  };

  // コンポーネントのアンマウント時にリソースをクリーンアップ
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // 必要音量計算
  useEffect(() => {
    if (audience > 0) {
      const volume = 10368; // m³
      const personDensity = audience / volume; // 人/m³
      const baseDb = 50 + personDensity * 50;
      setRequiredVolume(baseDb);
    } else {
      setRequiredVolume(0);
    }
  }, [audience]);

  const startRecording = async () => {
    try {
      // 既存の録音を停止
      stopRecording();
      
      // 最大音量リセット
      setMaxVolume(-Infinity);

      // 新しい録音を開始
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;

      const dataArray = new Uint8Array(analyserRef.current.fftSize);

      const process = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const value = (dataArray[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const db = 20 * Math.log10(rms);

        setVolume(db);
        
        // 最大音量を記録
        if (db > maxVolume) {
          setMaxVolume(db);
        }

        // 可決判定ロジック
        if (db > requiredVolume) {
          setApproved(true);
        } else {
          setApproved(false);
        }

        animationFrameRef.current = requestAnimationFrame(process);
      };

      animationFrameRef.current = requestAnimationFrame(process);
      setIsRecording(true);
    } catch (err) {
      console.error("録音の開始に失敗しました:", err);
      alert("マイクへのアクセスができませんでした。ブラウザの設定を確認してください。");
    }
  };

  // 音量レベル表示のためのスタイル計算
  const getVolumeBarStyle = () => {
    if (volume === null) return { width: '0%' };
    
    // -60dBから0dBの範囲で正規化
    const normalizedVolume = Math.max(0, Math.min(100, ((volume + 60) / 60) * 100));
    
    // 色の計算（音量に応じて緑→黄色→赤に変化）
    let color = 'bg-green-500';
    if (normalizedVolume > 80) color = 'bg-red-500';
    else if (normalizedVolume > 50) color = 'bg-yellow-500';
    
    return { 
      width: `${normalizedVolume}%`,
      className: color
    };
  };

  const volumeBarStyle = getVolumeBarStyle();
  
  // 基準音量のバーのスタイル
  const getRequiredVolumeMarkerStyle = () => {
    if (requiredVolume <= 0) return { left: '0%' };
    
    // -60dBから0dBの範囲で正規化
    const normalizedVolume = Math.max(0, Math.min(100, ((requiredVolume + 60) / 60) * 100));
    
    return { 
      left: `${normalizedVolume}%`,
    };
  };
  
  const requiredVolumeMarkerStyle = getRequiredVolumeMarkerStyle();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white p-6">
      <div className="w-full max-w-2xl bg-white p-8 rounded-2xl shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-800">学生総会 承認判定システム</h1>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-500 hover:text-blue-600 transition-colors"
            aria-label="情報を表示"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        
        {showInfo && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm">
            <h3 className="font-medium text-blue-800 mb-2">システム情報</h3>
            <p>体育館体積: 10,368 m³ (36m × 24m × 12m)</p>
            <p className="mt-2">このシステムは出席者の拍手の音量を測定し、設定された基準値に基づいて議案の可決/否決を判定します。</p>
          </div>
        )}
        
        <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            設定
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出席人数</label>
              <div className="relative rounded-lg shadow-sm">
                <input
                  type="number"
                  min="0"
                  className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  value={audience || ''}
                  onChange={(e) => setAudience(Number(e.target.value))}
                  placeholder="例: 500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-500">人</span>
                </div>
              </div>
            </div>
          </div>
          
          {requiredVolume > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-blue-600">判定基準:</span>
                  <div className="text-blue-800 font-bold text-2xl">
                    {requiredVolume.toFixed(2)} dB <span className="text-sm font-normal">以上で可決</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-blue-600">人口密度:</span>
                  <div className="font-medium text-blue-800">
                    {(audience / 10368).toFixed(4)} 人/m³
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-center mb-8">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!(audience > 0)}
              className="bg-blue-600 text-white py-4 px-8 rounded-xl hover:bg-blue-700 transition flex items-center space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg font-medium shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              <span>判定開始</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-600 text-white py-4 px-8 rounded-xl hover:bg-red-700 transition flex items-center space-x-2 text-lg font-medium shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              <span>判定停止</span>
            </button>
          )}
        </div>

        {isRecording && volume !== null && (
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
            <h3 className="text-lg font-medium text-gray-700 mb-4">音量測定結果</h3>
            
            <div className="mb-6 relative">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>静か (-60 dB)</span>
                <span>大きい (0 dB)</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden relative">
                {/* 必要音量のマーカー */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-blue-800 z-10"
                  style={{ left: requiredVolumeMarkerStyle.left }}
                >
                  <div className="absolute top-full mt-1 left-1/2 transform -translate-x-1/2 bg-blue-800 text-white text-xs px-1 py-0.5 rounded whitespace-nowrap">
                    基準値
                  </div>
                </div>
                
                {/* 現在の音量バー */}
                <div 
                  className={`h-full ${volumeBarStyle.className} transition-all duration-75`} 
                  style={{ width: volumeBarStyle.width }}
                ></div>
              </div>
              
              <div className="flex justify-between mt-4">
                <div>
                  <span className="text-sm text-gray-600">現在の音量:</span>
                  <div className="text-2xl font-bold">{volume.toFixed(2)} dB</div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-600">最大音量:</span>
                  <div className="text-2xl font-bold">{maxVolume.toFixed(2)} dB</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center mt-8">
              {approved !== null && (
                <div className={`text-center w-full py-5 px-4 rounded-xl ${approved ? 'bg-green-100 text-green-800 border-2 border-green-300' : 'bg-red-100 text-red-800 border-2 border-red-300'}`}>
                  <div className="text-3xl font-bold mb-1">
                    {approved ? '可決！' : '否決'}
                  </div>
                  <div className="text-lg">
                    {approved ? '基準値を超える拍手が検出されました 👏' : '基準値に達しませんでした 🙅‍♂️'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {!isRecording && audience > 0 && (
          <div className="text-center bg-yellow-50 p-4 rounded-lg border border-yellow-100 mt-4">
            <p className="text-yellow-800">「判定開始」ボタンをクリックして拍手の測定を開始してください</p>
          </div>
        )}
        
        {!(audience > 0) && (
          <div className="text-center bg-orange-50 p-4 rounded-lg border border-orange-100 mt-4">
            <p className="text-orange-800">出席人数を入力して判定基準を設定してください</p>
          </div>
        )}
        
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-gray-500 text-sm">
          学生総会承認判定システム v1.0 © 2025
        </div>
      </div>
    </main>
  );
}