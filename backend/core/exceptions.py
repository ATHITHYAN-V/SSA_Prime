from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    """
    Custom exception handler to format all error responses.
    """
    response = exception_handler(exc, context)

    error_message = f'An unexpected error occurred: {str(exc)}'
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR

    if response is not None:
        status_code = response.status_code
        
        if isinstance(response.data, dict):
            error_message = response.data.get('detail', str(response.data))
        else:
            error_message = str(response.data)

    custom_response_data = {
        "code": status_code,
        "status": False,
        "data": {
            "message": error_message
        }
    }

    return Response(custom_response_data, status=status_code)