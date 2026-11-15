import React, { useEffect, useState } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spinner
} from "@nextui-org/react";
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserIcon, PackageIcon, ArrowDownToLine } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import fetchQueriesHook from '@/hooks/fetchQueriesHook';
import useApiCallUtils from '@/hooks/useApiCallUtils';
import FileSaver from 'file-saver';
import CommonConfirmation from '@/components/CommonConfirmation';


const SubscriptionInquiries = () => {

  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();

  const [isAcceptPopup, setIsAcceptPopup] = useState({
    isOpen: false,
    id: "",
    agent_id: "",
    package_id: ""
  })

  const navigate = useNavigate();
  const queryClient = fetchQueriesHook();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [page, setPage] = useState(1);
  const [reason, setReason] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [search, setSearch] = useState('');
  const [tempsearch, setTempSearch] = useState('');
  const [status, setStatus] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default limit
  const limitOptions = [5, 10, 20, 50]; // Options for items per page

  useEffect(() => {
    const timeOut = setTimeout(() => {
      setSearch(tempsearch);
      setPage(1);
    }, 500);
    return () => clearTimeout(timeOut);
  }, [tempsearch]);

  const fetchTransactions = async () => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: itemsPerPage.toString(),
      ...(search && { search }),
      ...(status && { status }),
      ...(transactionDate && { transaction_date: transactionDate })
    });

    const { success, data, message } = await commonGetAPICalls(
      `/agent_admin_transections/admin_list?${queryParams}`
    );
    if (success) {
      return data;
    }
    throw new Error(message);
  };

  const { data, isFetching, error } = useQuery({
    queryKey: ['transactions', page, itemsPerPage, search, status, transactionDate],
    queryFn: fetchTransactions,
    enabled: true,
  });

  // Clear all filters
  const clearFilters = () => {
    setTempSearch('');
    setSearch('');
    setStatus('');
    setTransactionDate('');
    setPage(1);
    setItemsPerPage(10); // Reset to default
  };

  //  accept subscription mutation
  const acceptSubscription = async ({ id, agent_id, package_id }) => {
    // alert(id + " " + agent_id + " " + package_id)
    const { success, data, message } = await commonPostAPICall({
      agent_id,
      package_id
    }, `/agent_admin_transections/addSubscription/${id}`, true)
    if (success && success == true) {
      return data
    }
    throw new Error(message);
  };

  const acceptMutation = useMutation({
    mutationFn: acceptSubscription,
    onSuccess: () => {
      queryClient(['transactions']);
      setIsAcceptPopup({ isOpen: false, id: "", agent_id: "", package_id: "" });
    },
    onError: (error) => {
      console.error('Error accepting subscription:', error);
    }
  });

  // reject subscription mutation
  const rejectTransaction = async ({ id, reason }) => {
    const { success, data, message } = await commonPostAPICall({ reason, id }, `agent_admin_transections/reject_transaction`)
    if (success && success == true) {
      return data
    }
    throw new Error(message);
  };

  const rejectMutation = useMutation({
    mutationFn: rejectTransaction,
    onSuccess: () => {
      queryClient(['transactions']);
      setReason('');
      onClose();
    },
    onError: (error) => {
      console.error('Error rejecting transaction:', error);
    }
  });

  const handleAccept = () => {
    acceptMutation.mutate({
      id: isAcceptPopup.id,
      agent_id: isAcceptPopup.agent_id,
      package_id: isAcceptPopup.package_id
    });
  };

  const handleReject = () => {
    if (selectedTransactionId && reason.trim()) {
      rejectMutation.mutate({
        id: selectedTransactionId,
        reason: reason
      });
    }
  };

  const openRejectModal = (id) => {
    setSelectedTransactionId(id);
    onOpen();
  };

  if (error) return <div>Error: {error.message}</div>;

  const transactions = data?.rows || [];
  const totalPages = Math.ceil(data?.count / itemsPerPage) || 1;


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Subscription Inquiries</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row  flex-wrap gap-4 items-start sm:items-center">
        <Input
          label="Search by Transaction ID/Type"
          placeholder="Search transactions..."
          value={tempsearch}
          onChange={(e) => setTempSearch(e.target.value)}
          className="max-w-xs"
        />

        <Dropdown>
          <DropdownTrigger>
            <Button variant="bordered">
              {status || 'Select Status'}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Status selection"
            onAction={(key) => {
              setStatus(key as string);
              setPage(1);
            }}
          >
            <DropdownItem key="pending">Pending</DropdownItem>
            <DropdownItem key="accepted">Accepted</DropdownItem>
            <DropdownItem key="rejected">Rejected</DropdownItem>
          </DropdownMenu>
        </Dropdown>

        <Input
          type="date"
          label="Transaction Date"
          value={transactionDate}
          onChange={(e) => {
            setTransactionDate(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />

        <Button
          color="warning"
          onPress={clearFilters}
          disabled={!search && !status && !transactionDate && itemsPerPage === 10}
        >
          Clear Filters
        </Button>

        {/* Items per page selector */}
        <div className="flex items-center gap-2">
          <span>Items per page:</span>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="bordered">{itemsPerPage}</Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Items per page selection"
              onAction={(key) => {
                setItemsPerPage(Number(key));
                setPage(1);
              }}
            >
              {limitOptions?.map((option) => (
                <DropdownItem key={option}>{option}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {isFetching && <Spinner />}

      <Table aria-label="Subscription Inquiries Table">
        <TableHeader>
          <TableColumn>ID</TableColumn>
          <TableColumn>Transaction ID</TableColumn>
          <TableColumn>Type</TableColumn>
          <TableColumn>Date</TableColumn>
          <TableColumn>Amount</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Agent Details</TableColumn>
          <TableColumn>Package</TableColumn>
          <TableColumn>Payment Proof</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {transactions?.map((transaction) => (
            <TableRow key={transaction?.id}>
              <TableCell>{transaction?.id}</TableCell>
              <TableCell>{transaction?.transection_id}</TableCell>
              <TableCell>{transaction?.transaction_type}</TableCell>
              <TableCell>{new Date(transaction?.transection_date).toLocaleDateString()}</TableCell>
              <TableCell>{transaction?.amount}</TableCell>
              <TableCell>{transaction?.status}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div>
                    <p>{transaction?.agent.username}</p>
                    <p>{transaction?.agent.email}</p>
                    <p>{transaction?.agent.country_code} {transaction?.agent.phone}</p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    onPress={() => navigate(`/agents/${transaction?.agent.uuid}`)}
                  >
                    <UserIcon size={16} />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <p>{transaction?.package?.name}</p>
                  <Button
                    isIconOnly
                    size="sm"
                    onPress={() => navigate('/packages')}
                  >
                    <PackageIcon size={16} />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {transaction?.access_file && (
                  <div className="flex gap-2 items-center">
                    <img
                      src={transaction?.access_file}
                      alt="Payment Proof"
                      style={{ height: '20vh', cursor: 'pointer', width: "100%" }}
                      onClick={() => window.open(transaction?.access_file, '_blank')}
                    />
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      isIconOnly={true}
                      onPress={() => {
                        FileSaver.saveAs(transaction?.access_file);
                      }}
                    ><ArrowDownToLine /></Button>
                  </div>
                )}
              </TableCell>
              <TableCell>
                {transaction?.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      color="success"
                      size="sm"
                      onPress={() => setIsAcceptPopup({
                        isOpen: true,
                        agent_id:transaction?.agent?.id,
                        id:transaction?.id,
                        package_id:transaction?.package?.id,
                      })}
                      isLoading={acceptMutation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      onPress={() => openRejectModal(transaction?.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-4 flex justify-center">
        <Pagination
          total={totalPages}
          page={page}
          onChange={(newPage) => setPage(newPage)}
          showControls
          siblings={2}
          boundaries={1}
        />
      </div>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Reject Transaction</ModalHeader>
          <ModalBody>
            <Textarea
              label="Reason for rejection"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for rejection"
            />
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleReject}
              disabled={!reason.trim() || rejectMutation.isPending}
              isLoading={rejectMutation.isPending}>
              Submit
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* confirmation modal for accept subscription */}
      <CommonConfirmation
        isOpen={isAcceptPopup.isOpen}
        onOpenChange={() => setIsAcceptPopup({
          isOpen: false,
          id: "",
          agent_id: "",
          package_id: ""
        })}
        title="Are you sure you want to accept this transaction? This action cannot be undone."
        handleSubmit={()=>handleAccept()}
        nagativeTitle="No, Cancel"
        positiveTitle="Yes, Accept"
      />
    </div>
  );
};

export default SubscriptionInquiries;