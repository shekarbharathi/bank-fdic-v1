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
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a SQL expert. Generate only SQL queries, no explanations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for consistent SQL generation
                max_tokens=500
            )
            return response.choices[0].message.content.strip()
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
            message = self.client.messages.create(
                model=self.model,
                max_tokens=500,
                temperature=0.1,
                system="You are a SQL expert. Generate only SQL queries, no explanations.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            return message.content[0].text.strip()
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
            payload = {
                "model": self.model_name,
                "prompt": f"You are a SQL expert. Generate only SQL queries, no explanations.\n\n{prompt}",
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            }
            
            async with self.session.post(url, json=payload) as response:
                if response.status != 200:
                    raise Exception(f"Ollama API returned status {response.status}")
                result = await response.json()
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
