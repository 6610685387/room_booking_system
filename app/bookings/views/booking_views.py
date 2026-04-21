from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


# BookingViewSet will be implemented in Phase 4
class BookingViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        return Response(
            {"message": "Not implemented yet"}, status=status.HTTP_501_NOT_IMPLEMENTED
        )

    @action(detail=False, methods=["get"], url_path="my-bookings")
    def my_bookings(self, request):
        return Response(
            {"message": "Not implemented yet"}, status=status.HTTP_501_NOT_IMPLEMENTED
        )

    @action(detail=True, methods=["patch"])
    def cancel(self, request, pk=None):
        return Response(
            {"message": "Not implemented yet"}, status=status.HTTP_501_NOT_IMPLEMENTED
        )
