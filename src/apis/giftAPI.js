import axiosClient from '@/apis/axiosClient';

class GiftAPI {
    // General handler following the project pattern
    HandleGift = async (
        url = '',
        data,
        method = 'get',
    ) => {
        return await axiosClient(`/gift${url}`, {
            method: method ?? 'get',
            data,
        });
    };

    // Gift Package Methods
    getGiftPackages = async (facilityId = null) => {
        const params = facilityId ? `?facilityId=${facilityId}` : '';
        return await this.HandleGift(`/gift-packages${params}`, null, 'get');
    };

    getGiftPackageById = async (id) => {
        return await this.HandleGift(`/gift-packages/${id}`, null, 'get');
    };

    createGiftPackage = async (packageData) => {
        return await this.HandleGift('/gift-packages', packageData, 'post');
    };

    updateGiftPackage = async (id, packageData) => {
        return await this.HandleGift(`/gift-packages/${id}`, packageData, 'put');
    };

    deleteGiftPackage = async (id) => {
        return await this.HandleGift(`/gift-packages/${id}`, null, 'delete');
    };

    // Gift Item Methods
    getGiftItems = async (facilityId = null) => {
        const params = facilityId ? `?facilityId=${facilityId}` : '';
        return await this.HandleGift(`/gift-items${params}`, null, 'get');
    };

    getGiftItemById = async (id) => {
        return await this.HandleGift(`/gift-items/${id}`, null, 'get');
    };

    createGiftItem = async (itemData) => {
        return await this.HandleGift('/gift-items', itemData, 'post');
    };

    updateGiftItem = async (id, itemData) => {
        return await this.HandleGift(`/gift-items/${id}`, itemData, 'put');
    };

    deleteGiftItem = async (id) => {
        return await this.HandleGift(`/gift-items/${id}`, null, 'delete');
    };

    // Gift Distribution Methods
    distributeGiftPackage = async (distributionData) => {
        return await this.HandleGift('/distribution/gift-package', distributionData, 'post');
    };

    distributeGiftItem = async (distributionData) => {
        return await this.HandleGift('/distribution/gift-item', distributionData, 'post');
    };

    getDistributionHistory = async (facilityId = null, page = 1, limit = 20) => {
        const params = new URLSearchParams();
        if (facilityId) params.append('facilityId', facilityId);
        if (page) params.append('page', page);
        if (limit) params.append('limit', limit);
        
        const queryString = params.toString();
        const url = queryString ? `/distribution/history?${queryString}` : '/distribution/history';
        
        return await this.HandleGift(url, null, 'get');
    };

    getDistributionById = async (id) => {
        return await this.HandleGift(`/distribution/${id}`, null, 'get');
    };

    // Available Gifts for Distribution (after donation)
    getAvailableGifts = async (facilityId, donationId = null) => {
        const params = new URLSearchParams();
        if (facilityId) params.append('facilityId', facilityId);
        if (donationId) params.append('donationId', donationId);
        
        const queryString = params.toString();
        const url = queryString ? `/available?${queryString}` : '/available';
        
        return await this.HandleGift(url, null, 'get');
    };

    // Nurse specific method - Get available gifts for distribution
    getNurseAvailableGifts = async (donationId) => {
        return await axiosClient(`/gift/nurse/donations/${donationId}/available-gifts`, {
            method: 'get'
        });
    };

    // Admin Methods (system-wide view)
    getAdminGiftPackages = async (page = 1, limit = 20) => {
        const params = `?page=${page}&limit=${limit}`;
        return await this.HandleGift(`/admin/gift-packages${params}`, null, 'get');
    };

    getAdminDistributionStats = async (facilityId = null, startDate = null, endDate = null) => {
        const params = new URLSearchParams();
        if (facilityId) params.append('facilityId', facilityId);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const queryString = params.toString();
        const url = queryString ? `/admin/distribution-stats?${queryString}` : '/admin/distribution-stats';
        
        return await this.HandleGift(url, null, 'get');
    };

    // Inventory Methods
    getGiftInventory = async (facilityId) => {
        return await this.HandleGift(`/inventory?facilityId=${facilityId}`, null, 'get');
    };

    updateGiftInventory = async (facilityId, inventoryData) => {
        return await this.HandleGift(`/inventory?facilityId=${facilityId}`, inventoryData, 'put');
    };

    // Search Methods
    searchGifts = async (query, facilityId = null, type = 'all') => {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (facilityId) params.append('facilityId', facilityId);
        if (type && type !== 'all') params.append('type', type);
        
        const queryString = params.toString();
        const url = queryString ? `/search?${queryString}` : '/search';
        
        return await this.HandleGift(url, null, 'get');
    };

    // Nurse QR Scan for Gift Distribution
    nurseGiftScan = async (qrData) => {
        return await axiosClient('/blood-donation-registration/nurse/gift-scan', {
            method: 'post',
            data: { qrData }
        });
    };

    // Nurse specific distribution methods
    nurseDistributeGiftPackage = async (distributionData) => {
        return await axiosClient('/gift/nurse/distribute-package', {
            method: 'post',
            data: distributionData
        });
    };

    nurseDistributeGift = async (distributionData) => {
        return await axiosClient('/gift/nurse/distribute', {
            method: 'post',
            data: distributionData
        });
    };
}

const giftAPI = new GiftAPI();

export default giftAPI; 