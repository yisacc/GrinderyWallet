import React, { useRef, useState } from 'react';
import { View, Alert, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

const Index = () => {
  const webViewRef = useRef<WebView>(null);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const providerScript = `
    window.ethereum = {
      isMetaMask: true,
      chainId: '0x1',
      networkVersion: '1',
      selectedAddress: '${WALLET_ADDRESS}',
      _isConnected: false,
      _requestId: 0,
      
      request: async function(args) {
        const id = this._requestId++;
        const message = {
          type: 'provider_request',
          payload: {
            ...args,
            id: id
          }
        };
        
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
        
        return new Promise((resolve, reject) => {
          window.ethereum.callbacks = window.ethereum.callbacks || {};
          window.ethereum.callbacks[id] = { resolve, reject };
        });
      },

      on: function(eventName, callback) {
        window.ethereum.callbacks = window.ethereum.callbacks || {};
        window.ethereum.callbacks[eventName] = callback;
      },
      
      removeListener: function(eventName, callback) {
        if (window.ethereum.callbacks && window.ethereum.callbacks[eventName]) {
          delete window.ethereum.callbacks[eventName];
        }
      }
    };

    window.addEventListener('load', () => {
      if (!window.ethereum._isConnected && window.ethereum.callbacks && window.ethereum.callbacks['connect']) {
        window.ethereum._isConnected = true;
        window.ethereum.callbacks['connect']({ chainId: '0x1' });
        
        window.ethereum.request({ 
          method: 'eth_requestAccounts'
        }).then(accounts => {
          console.log('Connected with accounts:', accounts);
        }).catch(error => {
          console.error('Connection failed:', error);
        });
      }
    });
  `;

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'provider_request') {
        const { method, params, id } = data.payload;
        setPendingRequest(data.payload);

        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            if (isConnecting) return;
            setIsConnecting(true);

            Alert.alert(
              'Connect Wallet',
              'Would you like to connect your wallet to Uniswap?',
              [
                {
                  text: 'Cancel',
                  onPress: () => {
                    setIsConnecting(false);
                    sendResponse({ error: 'User rejected', id });
                  },
                  style: 'cancel',
                },
                {
                  text: 'Connect',
                  onPress: () => {
                    setIsConnecting(false);
                    sendResponse({ result: [WALLET_ADDRESS], id });
                  },
                },
              ]
            );
            break;

          case 'eth_sendTransaction':
            const tx = params[0];
            Alert.alert(
              'Confirm Transaction',
              `Would you like to confirm this transaction?\n\nTo: ${tx.to}\nValue: ${tx.value || '0'} ETH`,
              [
                {
                  text: 'Reject',
                  onPress: () => sendResponse({ error: 'User rejected transaction', id }),
                  style: 'cancel',
                },
                {
                  text: 'Confirm',
                  onPress: () => sendResponse({
                    result: '0x123...789',
                    id
                  }),
                },
              ]
            );
            break;

          default:
            sendResponse({ result: null, id });
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  const sendResponse = (response: { result?: any; error?: string; id: number }) => {
    const script = `
      if (window.ethereum.callbacks && window.ethereum.callbacks[${response.id}]) {
        ${response.error
        ? `window.ethereum.callbacks[${response.id}].reject(${JSON.stringify(response.error)})`
        : `window.ethereum.callbacks[${response.id}].resolve(${JSON.stringify(response.result)})`
      }
        delete window.ethereum.callbacks[${response.id}];
      }
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://app.uniswap.org' }}
        injectedJavaScriptBeforeContentLoaded={providerScript}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default Index;
