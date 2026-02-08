"""
LLM provider abstraction for text-to-SQL conversion
Supports OpenAI, Anthropic, and local models (Ollama)
"""
import os
import sys

# Handle imports for both Railway (backend as root) and local dev (project root)
if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, backend_dir)

from abc import ABC, abstractmethod
from typing import Optional
import logging

# Try relative imports first (for Railway), fallback to absolute (for local dev)
try:
    from config import (
        LLM_PROVIDER, OPENAI_API_KEY, OPENAI_MODEL,
        ANTHROPIC_API_KEY, ANTHROPIC_MODEL,
        LOCAL_MODEL_ENDPOINT, LOCAL_MODEL_NAME
    )
except ImportError:
    from backend.config import (
        LLM_PROVIDER, OPENAI_API_KEY, OPENAI_MODEL,
        ANTHROPIC_API_KEY, ANTHROPIC_MODEL,
        LOCAL_MODEL_ENDPOINT, LOCAL_MODEL_NAME
    )

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    @abstractmethod
    async def generate(self, prompt: str) -> str:
        """Generate response from prompt"""
        pass


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider"""
    
    def __init__(self):
        try:
            from openai import OpenAI
            if not OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set")
            self.client = OpenAI(api_key=OPENAI_API_KEY)
            self.model = OPENAI_MODEL
        except ImportError:
            raise ImportError("openai package not installed. Run: pip install openai")
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI provider: {e}")
    
    async def generate(self, prompt: str) -> str:
        """Generate SQL query using OpenAI"""
        try:
            # Debug: Log API call details
            logger.debug("=" * 80)
            logger.debug("OPENAI API CALL:")
            logger.debug("=" * 80)
            logger.debug(f"Model: {self.model}")
            logger.debug(f"Temperature: 0.1")
            logger.debug(f"Max Tokens: 500")
            logger.debug(f"Prompt Length: {len(prompt)} characters")
            logger.debug("=" * 80)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a SQL expert. Generate only SQL queries, no explanations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistent SQL generation
                max_tokens=500
            )
            
            # Debug: Log API response metadata
            logger.debug("=" * 80)
            logger.debug("OPENAI API RESPONSE METADATA:")
            logger.debug("=" * 80)
            logger.debug(f"Model Used: {response.model}")
            logger.debug(f"Usage - Prompt Tokens: {response.usage.prompt_tokens if hasattr(response.usage, 'prompt_tokens') else 'N/A'}")
            logger.debug(f"Usage - Completion Tokens: {response.usage.completion_tokens if hasattr(response.usage, 'completion_tokens') else 'N/A'}")
            logger.debug(f"Usage - Total Tokens: {response.usage.total_tokens if hasattr(response.usage, 'total_tokens') else 'N/A'}")
            logger.debug("=" * 80)
            
            result = response.choices[0].message.content.strip()
            return result
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider"""
    
    def __init__(self):
        try:
            from anthropic import Anthropic
            if not ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY not set")
            self.client = Anthropic(api_key=ANTHROPIC_API_KEY)
            self.model = ANTHROPIC_MODEL
        except ImportError:
            raise ImportError("anthropic package not installed. Run: pip install anthropic")
        except Exception as e:
            raise ValueError(f"Failed to initialize Anthropic provider: {e}")
    
    async def generate(self, prompt: str) -> str:
        """Generate SQL query using Anthropic Claude"""
        try:
            # Debug: Log API call details
            logger.debug("=" * 80)
            logger.debug("ANTHROPIC API CALL:")
            logger.debug("=" * 80)
            logger.debug(f"Model: {self.model}")
            logger.debug(f"Temperature: 0.1")
            logger.debug(f"Max Tokens: 500")
            logger.debug(f"Prompt Length: {len(prompt)} characters")
            logger.debug("=" * 80)
            
            message = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                temperature=0.1,
                system="You are a SQL expert. Generate only SQL queries, no explanations.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Debug: Log API response metadata
            logger.debug("=" * 80)
            logger.debug("ANTHROPIC API RESPONSE METADATA:")
            logger.debug("=" * 80)
            logger.debug(f"Model Used: {message.model}")
            if hasattr(message, 'usage'):
                logger.debug(f"Usage - Input Tokens: {message.usage.input_tokens if hasattr(message.usage, 'input_tokens') else 'N/A'}")
                logger.debug(f"Usage - Output Tokens: {message.usage.output_tokens if hasattr(message.usage, 'output_tokens') else 'N/A'}")
            logger.debug("=" * 80)
            
            result = message.content[0].text.strip()
            return result
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            raise


class LocalProvider(LLMProvider):
    """Local model provider (Ollama)"""
    
    def __init__(self):
        import aiohttp
        self.endpoint = LOCAL_MODEL_ENDPOINT
        self.model_name = LOCAL_MODEL_NAME
        self.session = None
    
    async def generate(self, prompt: str) -> str:
        """Generate SQL query using local Ollama model"""
        import aiohttp
        
        if not self.session:
            self.session = aiohttp.ClientSession()
        
        try:
            url = f"{self.endpoint}/api/generate"
            full_prompt = f"You are a SQL expert. Generate only SQL queries, no explanations.\n\n{prompt}"
            payload = {
                "model": self.model_name,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            }
            
            # Debug: Log API call details
            logger.debug("=" * 80)
            logger.debug("LOCAL OLLAMA API CALL:")
            logger.debug("=" * 80)
            logger.debug(f"Endpoint: {url}")
            logger.debug(f"Model: {self.model_name}")
            logger.debug(f"Temperature: 0.1")
            logger.debug(f"Prompt Length: {len(full_prompt)} characters")
            logger.debug("=" * 80)
            
            async with self.session.post(url, json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Ollama API returned status {response.status}")
                result = await response.json()
                
                # Debug: Log API response metadata
                logger.debug("=" * 80)
                logger.debug("LOCAL OLLAMA API RESPONSE METADATA:")
                logger.debug("=" * 80)
                logger.debug(f"Status: {response.status}")
                logger.debug(f"Response Keys: {list(result.keys())}")
                logger.debug("=" * 80)
                
                return result.get("response", "").strip()
        except Exception as e:
            logger.error(f"Local model error: {e}")
            raise


def get_llm_provider() -> LLMProvider:
    """
    Factory function to get the configured LLM provider
    
    Returns:
        LLMProvider instance
    """
    provider_map = {
        'OPENAI': OpenAIProvider,
        'ANTHROPIC': AnthropicProvider,
        'LOCAL': LocalProvider
    }
    
    provider_class = provider_map.get(LLM_PROVIDER)
    if not provider_class:
        raise ValueError(f"Unknown LLM provider: {LLM_PROVIDER}. Use OPENAI, ANTHROPIC, or LOCAL")
    
    try:
        return provider_class()
    except Exception as e:
        logger.error(f"Failed to initialize LLM provider {LLM_PROVIDER}: {e}")
        raise
