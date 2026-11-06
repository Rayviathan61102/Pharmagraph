"""Problems the service layer reports. The server turns them into HTTP errors (see app.py)."""


class NotFound(Exception):
    """404: the item does not exist."""


class Invalid(Exception):
    """400: the request breaks a rule, e.g. editing an archived item."""


class Conflict(Exception):
    """409: needs a decision from the user first, e.g. a possible duplicate."""

    def __init__(self, message: str, details: dict):
        super().__init__(message)
        self.details = details
