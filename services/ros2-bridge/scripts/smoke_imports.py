import importlib


def _check(mod: str) -> None:
    importlib.import_module(mod)


def main() -> None:
    _check("fastapi")
    _check("uvicorn")
    _check("httpx")
    _check("pydantic")
    _check("pi_ros2_bridge.api")


if __name__ == "__main__":
    main()

