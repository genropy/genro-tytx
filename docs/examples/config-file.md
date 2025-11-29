# Example: Configuration Files

Using TYTX for typed configuration.

## Scenario

Application configuration needs:
- Numeric settings (timeouts, limits) as integers
- Rate limits as Decimal for precision
- Feature flags as booleans
- Dates for scheduled features

## XML Configuration

<!-- test: test_core.py::TestXMLNewStructure::test_from_xml_nested -->

```python
from genro_tytx import from_xml

config_xml = '''
<config version="1.0">
    <database>
        <host>localhost</host>
        <port>5432::L</port>
        <pool_size>10::L</pool_size>
        <timeout>30.5::R</timeout>
    </database>
    <api>
        <rate_limit>100.50::N</rate_limit>
        <max_requests>1000::L</max_requests>
        <enabled>true::B</enabled>
    </api>
    <features>
        <dark_mode>true::B</dark_mode>
        <beta_features>false::B</beta_features>
        <launch_date>2025-02-01::D</launch_date>
    </features>
</config>
'''

config = from_xml(config_xml)

# Access typed values
db = config["config"]["value"]["database"]["value"]
port = db["port"]["value"]           # → 5432 (int)
pool_size = db["pool_size"]["value"] # → 10 (int)
timeout = db["timeout"]["value"]     # → 30.5 (float)

api = config["config"]["value"]["api"]["value"]
rate_limit = api["rate_limit"]["value"]    # → Decimal("100.50")
max_requests = api["max_requests"]["value"] # → 1000 (int)
enabled = api["enabled"]["value"]          # → True (bool)

features = config["config"]["value"]["features"]["value"]
dark_mode = features["dark_mode"]["value"]     # → True (bool)
launch_date = features["launch_date"]["value"] # → date(2025, 2, 1)
```

## JSON Configuration

```python
from genro_tytx import from_json

config_json = '''
{
    "database": {
        "host": "localhost",
        "port": "5432::L",
        "pool_size": "10::L",
        "timeout": "30.5::R"
    },
    "api": {
        "rate_limit": "100.50::N",
        "max_requests": "1000::L",
        "enabled": "true::B"
    },
    "features": {
        "dark_mode": "true::B",
        "launch_date": "2025-02-01::D"
    }
}
'''

config = from_json(config_json)

# Direct access
port = config["database"]["port"]           # → 5432 (int)
rate_limit = config["api"]["rate_limit"]    # → Decimal("100.50")
launch_date = config["features"]["launch_date"]  # → date(2025, 2, 1)
```

## Config Dataclass

```python
from dataclasses import dataclass
from decimal import Decimal
from datetime import date
from genro_tytx import from_json

@dataclass
class DatabaseConfig:
    host: str
    port: int
    pool_size: int
    timeout: float

@dataclass
class ApiConfig:
    rate_limit: Decimal
    max_requests: int
    enabled: bool

@dataclass
class FeaturesConfig:
    dark_mode: bool
    launch_date: date

@dataclass
class AppConfig:
    database: DatabaseConfig
    api: ApiConfig
    features: FeaturesConfig

def load_config(json_str: str) -> AppConfig:
    data = from_json(json_str)
    return AppConfig(
        database=DatabaseConfig(**data["database"]),
        api=ApiConfig(**data["api"]),
        features=FeaturesConfig(**data["features"])
    )

# Usage
config = load_config(config_json)
print(config.database.port)        # → 5432 (int)
print(config.api.rate_limit)       # → Decimal("100.50")
print(config.features.launch_date) # → date(2025, 2, 1)
```

## Generating Configuration

```python
from genro_tytx import as_typed_json, as_typed_xml
from decimal import Decimal
from datetime import date

config = {
    "database": {
        "host": "localhost",
        "port": 5432,
        "pool_size": 10
    },
    "api": {
        "rate_limit": Decimal("100.50"),
        "max_requests": 1000,
        "enabled": True
    },
    "features": {
        "launch_date": date(2025, 2, 1)
    }
}

# Save as typed JSON
with open("config.json", "w") as f:
    f.write(as_typed_json(config))

# Save as typed XML
xml_config = {
    "config": {
        "attrs": {"version": "1.0"},
        "value": {
            "database": {
                "attrs": {},
                "value": {
                    "host": {"attrs": {}, "value": "localhost"},
                    "port": {"attrs": {}, "value": 5432}
                }
            }
        }
    }
}
with open("config.xml", "w") as f:
    f.write(as_typed_xml(xml_config))
```

## Environment Override

```python
import os
from genro_tytx import from_text, from_json

def load_config_with_env():
    # Load base config
    with open("config.json") as f:
        config = from_json(f.read())

    # Override from environment
    if "DB_PORT" in os.environ:
        config["database"]["port"] = from_text(os.environ["DB_PORT"], "L")

    if "API_RATE_LIMIT" in os.environ:
        config["api"]["rate_limit"] = from_text(os.environ["API_RATE_LIMIT"], "N")

    if "LAUNCH_DATE" in os.environ:
        config["features"]["launch_date"] = from_text(os.environ["LAUNCH_DATE"], "D")

    return config

# Usage
# DB_PORT=3306 API_RATE_LIMIT=50.00 python app.py
config = load_config_with_env()
```

## Benefits

1. **Type preservation**: No manual type conversion
2. **Validation**: Parse fails on invalid values
3. **Flexibility**: JSON or XML format
4. **Environment compatible**: Easy override with explicit types
